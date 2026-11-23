import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import ts from "typescript";

async function loadTs(path) {
  const source = readFileSync(path, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const security = await loadTs("src/features/payments/flouci-security.ts");
const reconciliation = await loadTs("src/features/payments/flouci-reconciliation.ts");
const domesticDelivery = await loadTs("src/features/checkout/tunisia-delivery.ts");
const raw = Buffer.from('{"event":"payment.succeeded","amount":57000}');
const secret = "unit-test-secret";
const timestamp = String(Math.floor(Date.now() / 1000));
const digest = createHmac("sha256", secret).update(`${timestamp}.`).update(raw).digest("hex");
const signature = `t=${timestamp},v1=${digest}`;
const event = {
  event: "payment.succeeded", event_id: "event-1", payment_id: "payment-1",
  developer_tracking_id: "123e4567-e89b-42d3-a456-426614174000", amount: 57000,
  currency: "TND", payment_method: "card",
};
const verified = { success: true, result: {
  status: "SUCCESS", amount: 57000, type: "card", currency: "TND",
  developer_tracking_id: event.developer_tracking_id,
} };

test("Flouci webhook signature covers timestamp and exact raw bytes", () => {
  assert.equal(security.verifyFlouciSignature(raw, signature, secret), true);
  assert.equal(security.verifyFlouciSignature(Buffer.from(`${raw} `), signature, secret), false);
  assert.equal(security.verifyFlouciSignature(raw, `t=${timestamp},v1=${"0".repeat(64)}`, secret), false);
  assert.equal(security.verifyFlouciSignature(raw, null, secret), false);
});

test("Flouci webhook signature rejects timestamps outside the replay window", () => {
  const oldTimestamp = String(Math.floor(Date.now() / 1000) - 301);
  const oldDigest = createHmac("sha256", secret).update(`${oldTimestamp}.`).update(raw).digest("hex");
  assert.equal(security.verifyFlouciSignature(raw, `t=${oldTimestamp},v1=${oldDigest}`, secret), false);
});

test("successful Flouci card payment must match verified amount, currency, type and tracking ID", () => {
  assert.deepEqual(security.validateVerifiedFlouciEvent(event, verified), { status: "SUCCESS" });
  assert.equal(security.validateVerifiedFlouciEvent({ ...event, amount: 56000 }, verified), null);
  assert.equal(security.validateVerifiedFlouciEvent({ ...event, currency: "USD" }, verified), null);
  assert.equal(security.validateVerifiedFlouciEvent({ ...event, developer_tracking_id: "wrong" }, verified), null);
  assert.equal(security.validateVerifiedFlouciEvent(event, { ...verified, result: { ...verified.result, type: "wallet" } }), null);
  assert.equal(security.validateVerifiedFlouciEvent(event, { success: false, result: verified.result }), null);
});

test("failed and expired events require a matching verified terminal state", () => {
  const failedEvent = { ...event, event: "payment.failed", payment_method: "NA" };
  assert.deepEqual(security.validateVerifiedFlouciEvent(failedEvent, {
    success: true, result: { status: "EXPIRED", amount: 57000, type: "NA", developer_tracking_id: event.developer_tracking_id },
  }), { status: "EXPIRED" });
  assert.deepEqual(security.validateVerifiedFlouciEvent({ ...event, event: "payment.failed" }, {
    success: true, result: { ...verified.result, status: "FAILURE" },
  }), { status: "FAILURE" });
  assert.equal(security.validateVerifiedFlouciEvent(failedEvent, verified), null);
});

const expectedTracking = "123e4567-e89b-42d3-a456-426614174000";
const baseVerification = (status) => ({ success: true, result: {
  status, amount: 42000, type: "card", currency: "TND", developer_tracking_id: expectedTracking,
} });
const reconcile = (verification, extra = {}) => reconciliation.decideFlouciReconciliation({
  verification, expectedTrackingId: expectedTracking, expectedAmountMillimes: 42000,
  paymentId: "flouci-tx-1", inventoryReleased: false, currencyConfirmedByAdmin: false, ...extra,
});

test("pending payment expiry stays reserved until Flouci confirms a terminal state", () => {
  assert.deepEqual(reconcile(baseVerification("PENDING")), { action: "keep_pending", reason: "provider_pending" });
  assert.deepEqual(reconcile(baseVerification("EXPIRED")), { action: "release_reservation", status: "EXPIRED", currency: "TND" });
  assert.deepEqual(reconcile(baseVerification("FAILURE")), { action: "release_reservation", status: "FAILURE", currency: "TND" });
});

test("expired and failed sessions with type NA release stock but success with type NA enters manual review", () => {
  assert.deepEqual(
    reconcile({ ...baseVerification("EXPIRED"), result: { ...baseVerification("EXPIRED").result, type: "NA" } }),
    { action: "release_reservation", status: "EXPIRED", currency: "TND" }
  );
  assert.deepEqual(
    reconcile({ ...baseVerification("FAILURE"), result: { ...baseVerification("FAILURE").result, type: "NA" } }),
    { action: "release_reservation", status: "FAILURE", currency: "TND" }
  );
  assert.deepEqual(
    reconcile({ ...baseVerification("SUCCESS"), result: { ...baseVerification("SUCCESS").result, type: "NA" } }),
    { action: "manual_review", reason: "identity_mismatch" }
  );
  assert.deepEqual(
    reconcile({ ...baseVerification("PENDING"), result: { ...baseVerification("PENDING").result, type: "NA" } }),
    { action: "manual_review", reason: "identity_mismatch" }
  );
});

test("unverified responses or missing payment IDs never release stock", () => {
  assert.deepEqual(reconcile(null), { action: "manual_review", reason: "initialization_timeout" });
  assert.deepEqual(reconcile({ success: false, result: null }), { action: "manual_review", reason: "initialization_timeout" });
  assert.deepEqual(
    reconcile({
      success: false,
      result: { status: "EXPIRED", amount: 42000, type: "NA", developer_tracking_id: expectedTracking },
    }),
    { action: "manual_review", reason: "initialization_timeout" }
  );
  assert.deepEqual(reconcile(baseVerification("EXPIRED"), { paymentId: null }), { action: "manual_review", reason: "initialization_timeout" });
  assert.deepEqual(reconcile(baseVerification("FAILURE"), { paymentId: "" }), { action: "manual_review", reason: "initialization_timeout" });
  assert.deepEqual(reconcile(baseVerification("EXPIRED"), { paymentId: undefined }), { action: "manual_review", reason: "initialization_timeout" });
});

test("ambiguous tracking IDs, mismatched amounts, or unknown provider statuses never settle or release", () => {
  // Tracking ID mismatch
  assert.deepEqual(
    reconcile({ ...baseVerification("EXPIRED"), result: { ...baseVerification("EXPIRED").result, developer_tracking_id: "other-tracking-id" } }),
    { action: "manual_review", reason: "identity_mismatch" }
  );
  assert.deepEqual(
    reconcile({ ...baseVerification("SUCCESS"), result: { ...baseVerification("SUCCESS").result, developer_tracking_id: "other-tracking-id" } }),
    { action: "manual_review", reason: "identity_mismatch" }
  );
  // Amount mismatch
  assert.deepEqual(
    reconcile(baseVerification("EXPIRED"), { expectedAmountMillimes: 50000 }),
    { action: "manual_review", reason: "identity_mismatch" }
  );
  assert.deepEqual(
    reconcile({ ...baseVerification("EXPIRED"), result: { ...baseVerification("EXPIRED").result, amount: 41999 } }),
    { action: "manual_review", reason: "identity_mismatch" }
  );
  // Unknown or unconfirmed provider statuses
  assert.deepEqual(
    reconcile({ ...baseVerification("REFUNDED") }),
    { action: "manual_review", reason: "provider_unknown" }
  );
  assert.deepEqual(
    reconcile({ ...baseVerification("CANCELLED") }),
    { action: "manual_review", reason: "provider_unknown" }
  );
});

test("confirmed successful payment settles only the matching TND card order", () => {
  assert.deepEqual(reconcile(baseVerification("SUCCESS")), { action: "settle_success", status: "SUCCESS", currency: "TND" });
  assert.equal(reconcile(baseVerification("SUCCESS"), { verification: baseVerification("SUCCESS"), expectedAmountMillimes: 41000 }).action, "manual_review");
  assert.equal(reconcile({ ...baseVerification("SUCCESS"), result: { ...baseVerification("SUCCESS").result, currency: "USD" } }).action, "manual_review");
  assert.equal(reconcile({ ...baseVerification("SUCCESS"), result: { ...baseVerification("SUCCESS").result, type: "wallet" } }).action, "manual_review");
  assert.equal(reconcile({ ...baseVerification("SUCCESS"), result: { ...baseVerification("SUCCESS").result, developer_tracking_id: "other" } }).action, "manual_review");
});

test("unknown status, provider outage and initialization timeout keep stock reserved", () => {
  assert.deepEqual(reconcile(baseVerification("SYSTEM_FAILURE")), { action: "manual_review", reason: "provider_unknown" });
  assert.deepEqual(reconcile(null), { action: "manual_review", reason: "initialization_timeout" });
  assert.equal(reconcile({ success: false, result: null }).action, "manual_review");
  const currencyMissing = { success: true, result: { ...baseVerification("EXPIRED").result, currency: undefined } };
  assert.deepEqual(reconcile(currencyMissing), { action: "manual_review", reason: "currency_unconfirmed" });
  assert.deepEqual(reconcile(currencyMissing, { currencyConfirmedByAdmin: true }), { action: "release_reservation", status: "EXPIRED", currency: "TND" });
});

test("duplicate reconciliation outcome IDs are stable and distinct statuses do not collide", () => {
  const first = reconciliation.stableReconciliationEventId("payment-1", "EXPIRED");
  assert.equal(first, reconciliation.stableReconciliationEventId("payment-1", "EXPIRED"));
  assert.notEqual(first, reconciliation.stableReconciliationEventId("payment-1", "SUCCESS"));
});

test("late success after inventory release enters manual review and cannot settle", () => {
  assert.deepEqual(reconcile(baseVerification("SUCCESS"), { inventoryReleased: true }), { action: "manual_review", reason: "late_success_after_release" });
});

test("initialization timeout without a payment ID is never treated as failure or released stock", () => {
  const decision = reconciliation.decideFlouciReconciliation({
    verification: baseVerification("EXPIRED"), expectedTrackingId: expectedTracking,
    expectedAmountMillimes: 42000, paymentId: null, inventoryReleased: false, currencyConfirmedByAdmin: true,
  });
  assert.deepEqual(decision, { action: "manual_review", reason: "initialization_timeout" });
});

test("payment RPC migration preserves COD, adds delivery in millimes, and makes payment transitions atomic", () => {
  const migration = readFileSync("supabase/migrations/202611190001_flouci_card_payments.sql", "utf8");
  assert.match(migration, /create_cod_order\(p_idempotency_key uuid, p_customer jsonb, p_items jsonb\)/);
  assert.match(migration, /'cash_on_delivery'\);/);
  assert.match(migration, /v_shipping bigint := 7000/);
  assert.match(migration, /v_total := v_subtotal - v_discount \+ v_shipping/);
  assert.match(migration, /for update of v/);
  assert.match(migration, /stock = stock -/);
  assert.match(migration, /stock = stock \+ v_item\.quantity/);
  assert.match(migration, /inventory_released_at is null/);
  assert.match(migration, /inventory_released_at = now\(\)/);
  assert.match(migration, /late_success_after_stock_release/);
  assert.match(migration, /search_path = pg_catalog(?:\s|$)/);
  assert.doesNotMatch(migration, /search_path = pg_catalog, public/);
  assert.match(migration, /revoke create on schema public from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.flag_flouci_payment_review\(uuid, text\) to service_role/);
  assert.doesNotMatch(migration, /update public\.orders[\s\S]{0,100}set total_millimes/);
  assert.match(migration, /flouci_payment_events \(\s*event_id text primary key/s);
  assert.match(migration, /revoke all on function public\.create_flouci_order[\s\S]*?from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.settle_flouci_payment_event[\s\S]*?to service_role/);
});

test("domestic COD and card order totals include exactly one 7,000 millime delivery fee", () => {
  assert.equal(domesticDelivery.calculateDomesticOrderTotalMillimes(35000), 42000);
  assert.equal(domesticDelivery.calculateDomesticOrderTotalMillimes(105000, 55000), 57000);
  const migration = readFileSync("supabase/migrations/202611190001_flouci_card_payments.sql", "utf8");
  assert.match(migration, /v_shipping bigint := 7000/);
  assert.match(migration, /v_total := v_subtotal - v_discount \+ v_shipping/);
  assert.match(migration, /shipping_millimes, flouci_tracking_id[\s\S]*?v_shipping, v_tracking/);
  assert.doesNotMatch(readFileSync("src/app/api/orders/route.ts", "utf8"), /total_millimes|shipping_millimes/);
  assert.doesNotMatch(readFileSync("src/app/api/payments/flouci/initiate/route.ts", "utf8"), /\+\s*7000|shipping_millimes\s*\+/);
});

test("international destinations cannot be checked out or charged domestic shipping", () => {
  assert.equal(domesticDelivery.normalizeTunisiaGovernorate("Tunis"), "Tunis");
  assert.equal(domesticDelivery.normalizeTunisiaGovernorate("Paris"), null);
  const migration = readFileSync("supabase/migrations/202611190001_flouci_card_payments.sql", "utf8");
  assert.match(migration, /lower\(trim\(p_customer->>'governorate'\)\) = any/);
  assert.match(readFileSync("src/app/api/orders/route.ts", "utf8"), /normalizeTunisiaGovernorate/);
  assert.match(readFileSync("src/app/api/payments/flouci/initiate/route.ts", "utf8"), /normalizeTunisiaGovernorate/);
});

test("admin reconciliation is authenticated and missing IDs use documented history lookup without stock release", () => {
  const route = readFileSync("src/app/api/admin/orders/[id]/reconcile-payment/route.ts", "utf8");
  const server = readFileSync("src/lib/flouci-server.ts", "utf8");
  assert.match(route, /authorizeAdminRequest\(request, true\)/);
  assert.match(route, /flouciSearchHistoryByTrackingId/);
  assert.match(route, /flag_flouci_payment_review/);
  assert.match(server, /\/history/);
  assert.match(server, /developer_tracking_id/);
  assert.match(route, /currencyConfirmedTnd/);
});

test("Flouci initialization uses millimes, card acceptance, webhook v2 and a hosted redirect", () => {
  const server = readFileSync("src/lib/flouci-server.ts", "utf8");
  const route = readFileSync("src/app/api/payments/flouci/initiate/route.ts", "utf8");
  assert.match(server, /amount: String\(input\.amountMillimes\)/);
  assert.match(server, /accept_card: true/);
  assert.match(server, /webhook_version: 2/);
  assert.match(server, /Authorization: `Bearer \$\{settings\.publicKey\}:\$\{settings\.privateKey\}`/);
  assert.match(server, /^import "server-only";/);
  assert.match(route, /create_flouci_order/);
  assert.match(route, /record_flouci_payment_session/);
  assert.match(route, /validHostedPaymentUrl/);
  assert.doesNotMatch(route, /payment_status:\s*"paid"/);
});

test("COD route remains separate and does not set a prepaid status", () => {
  const cod = readFileSync("src/app/api/orders/route.ts", "utf8");
  assert.match(cod, /create_cod_order/);
  assert.doesNotMatch(cod, /payment_status/);
  assert.doesNotMatch(cod, /flouci/i);
});
