import { adminJson, authorizeAdminRequest, isAdminIdentity, readJson } from "@/lib/admin-api";
import { getAdminOrder } from "@/lib/admin-data";
import { isUuid } from "@/lib/admin-validation";
import { decideFlouciReconciliation, stableReconciliationEventId } from "@/features/payments/flouci-reconciliation";
import { flouciSearchHistoryByTrackingId, flouciVerifyPayment, getFlouciSettings, paymentRpc } from "@/lib/flouci-server";
import type { FlouciVerification } from "@/features/payments/flouci-security";

const SESSION_TIMEOUT_MS = 20 * 60_000;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdminRequest(request, true);
  if (!isAdminIdentity(auth)) return auth;
  const { id } = await params;
  if (!isUuid(id)) return adminJson({ error: "Order not found." }, 404);
  const body = await readJson(request);
  if (!body || typeof body !== "object") return adminJson({ error: "Invalid reconciliation request." }, 400);
  const input = body as { paymentId?: unknown; currencyConfirmedTnd?: unknown };
  const suppliedPaymentId = typeof input.paymentId === "string" ? input.paymentId.trim() : "";
  if (suppliedPaymentId && !/^[A-Za-z0-9_-]{1,200}$/.test(suppliedPaymentId)) {
    return adminJson({ error: "Enter the payment ID from the Flouci merchant dashboard." }, 400);
  }

  let order;
  try { order = (await getAdminOrder(id)).order; }
  catch { return adminJson({ error: "Order status could not be verified." }, 503); }
  if (!order || order.payment_method !== "flouci" || !order.flouci_tracking_id) {
    return adminJson({ error: "This is not a Flouci order." }, 404);
  }
  if (order.payment_status === "paid") return adminJson({ error: "This order is already paid." }, 409);
  if (Date.now() - new Date(order.created_at).getTime() < SESSION_TIMEOUT_MS) {
    return adminJson({ error: "The 20-minute Flouci session window has not elapsed. Stock remains reserved." }, 409);
  }

  const settings = getFlouciSettings();
  if (!settings) return adminJson({ error: "Flouci reconciliation is not configured." }, 503);
  const paymentId = order.flouci_payment_id ?? suppliedPaymentId;
  if (order.flouci_payment_id && suppliedPaymentId && order.flouci_payment_id !== suppliedPaymentId) {
    return adminJson({ error: "The supplied payment ID does not match the saved Flouci session." }, 409);
  }

  if (!paymentId) {
    let history;
    try { history = await flouciSearchHistoryByTrackingId(settings, order.flouci_tracking_id, order.created_at); }
    catch { history = { ok: false as const, matches: [], truncated: false }; }
    try {
      await paymentRpc<boolean>("flag_flouci_payment_review", {
        p_tracking_id: order.flouci_tracking_id,
        p_reason: history.ok ? "payment_id_missing" : "provider_unavailable",
      });
    } catch { return adminJson({ error: "Manual review could not be recorded; stock remains reserved." }, 503); }
    return adminJson({
      data: {
        payment_status: "review_required",
        inventory_released: Boolean(order.inventory_released_at),
        history: history.ok ? {
          match_count: history.matches.length,
          truncated: history.truncated,
          candidates: history.matches.map((match) => ({ status: match.status, amount_millimes: match.amountMillimes, type: match.type, created_at: match.createdAt })),
        } : null,
        message: "No payment ID was saved. Check Flouci transaction history using the tracking ID, retrieve the payment ID from the merchant dashboard, then verify it here. No inventory was released.",
      },
    });
  }

  let verification: FlouciVerification | null = null;
  try {
    const response = await flouciVerifyPayment(settings, paymentId);
    if (response.ok) verification = await response.json().catch(() => null) as FlouciVerification | null;
  } catch { /* Keep the reservation if provider verification is unavailable. */ }

  const decision = decideFlouciReconciliation({
    verification,
    expectedTrackingId: order.flouci_tracking_id,
    expectedAmountMillimes: Number(order.total_millimes),
    paymentId,
    inventoryReleased: Boolean(order.inventory_released_at),
    currencyConfirmedByAdmin: input.currencyConfirmedTnd === true,
  });

  if (decision.action === "keep_pending") {
    return adminJson({ data: { payment_status: order.payment_status, inventory_released: Boolean(order.inventory_released_at), message: "Flouci still reports PENDING. Stock remains reserved." } });
  }
  if (decision.action === "manual_review") {
    const reason = decision.reason === "late_success_after_release" ? "late_success_after_stock_release"
      : decision.reason === "identity_mismatch" ? "identity_mismatch"
        : decision.reason === "currency_unconfirmed" ? "currency_unconfirmed"
          : decision.reason === "initialization_timeout" ? "initialization_timeout"
            : "provider_status_unknown";
    try { await paymentRpc<boolean>("flag_flouci_payment_review", { p_tracking_id: order.flouci_tracking_id, p_reason: reason }); }
    catch { return adminJson({ error: "Manual review state could not be recorded; stock was not changed." }, 503); }
    return adminJson({ data: { payment_status: "review_required", inventory_released: Boolean(order.inventory_released_at), message: decision.reason === "late_success_after_release"
      ? "Flouci reports a late success after stock was released. The order remains cancelled and requires manual refund or customer resolution; it cannot be fulfilled automatically."
      : "Provider details are incomplete or uncertain. The order is flagged for manual review and stock remains reserved unless already released." } });
  }

  const status = decision.status;
  const eventId = stableReconciliationEventId(paymentId, status);
  try {
    const result = await paymentRpc<{ accepted: boolean; duplicate: boolean; payment_status: string; reconciliation_required?: boolean }>(
      "settle_flouci_payment_event",
      {
        p_event_id: eventId,
        p_event_type: status === "SUCCESS" ? "payment.succeeded" : "payment.failed",
        p_payment_id: paymentId,
        p_tracking_id: order.flouci_tracking_id,
        p_amount_millimes: Number(order.total_millimes),
        p_currency: decision.currency,
        p_verified_status: status,
      },
    );
    if (!result.accepted) return adminJson({ error: "Verified transaction could not be applied." }, 409);
    return adminJson({ data: {
      payment_status: result.payment_status,
      inventory_released: status !== "SUCCESS" || Boolean(order.inventory_released_at),
      duplicate: result.duplicate,
      manual_review: result.reconciliation_required === true,
      message: result.reconciliation_required
        ? "Payment succeeded after stock release. The order is cancelled and requires manual resolution; it will not be fulfilled automatically."
        : status === "SUCCESS" ? "Flouci payment verified. Order status remains unchanged for normal admin processing."
          : "Flouci confirmed a terminal unpaid state. Reserved stock was released once.",
    } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("unique") || message.includes("duplicate") || message.includes("orders_flouci_payment_id_unique")) {
      return adminJson({ error: "This Flouci payment ID is already linked to another order." }, 409);
    }
    return adminJson({ error: "Reconciliation could not be recorded. The order was not automatically fulfilled." }, 503);
  }
}
