import type { FlouciVerification } from "@/features/payments/flouci-security";
import { createHash } from "node:crypto";

export type ReconciliationDecision =
  | { action: "settle_success"; status: "SUCCESS"; currency: "TND" }
  | { action: "release_reservation"; status: "FAILURE" | "EXPIRED"; currency: "TND" }
  | { action: "keep_pending"; reason: "provider_pending" }
  | { action: "manual_review"; reason: "provider_unknown" | "identity_mismatch" | "currency_unconfirmed" | "late_success_after_release" | "initialization_timeout" };

export function decideFlouciReconciliation(input: {
  verification: FlouciVerification | null;
  expectedTrackingId: string;
  expectedAmountMillimes: number;
  paymentId: string | null;
  inventoryReleased: boolean;
  currencyConfirmedByAdmin: boolean;
}): ReconciliationDecision {
  const result = input.verification?.result;
  if (!input.paymentId || !input.verification?.success || !result) {
    return { action: "manual_review", reason: "initialization_timeout" };
  }
  const amount = typeof result.amount === "string" && /^\d+$/.test(result.amount.trim())
    ? Number(result.amount.trim())
    : result.amount;
  const rawStatus = typeof result.status === "string" ? result.status.trim().toUpperCase() : "";
  const resultTracking = typeof result.developer_tracking_id === "string" ? result.developer_tracking_id.trim() : null;
  const resultCurrency = typeof result.currency === "string" ? result.currency.trim().toUpperCase() : undefined;
  const isTerminalFailureOrExpired = rawStatus === "FAILURE" || rawStatus === "EXPIRED";
  const isValidType = result.type === "card" || (isTerminalFailureOrExpired && result.type === "NA");
  if (resultTracking !== input.expectedTrackingId ||
      !Number.isSafeInteger(amount) || amount !== input.expectedAmountMillimes || !isValidType) {
    return { action: "manual_review", reason: "identity_mismatch" };
  }
  if (resultCurrency !== undefined && resultCurrency !== "TND") {
    return { action: "manual_review", reason: "identity_mismatch" };
  }
  if (resultCurrency === undefined && !input.currencyConfirmedByAdmin) {
    return { action: "manual_review", reason: "currency_unconfirmed" };
  }
  if (rawStatus === "PENDING") return { action: "keep_pending", reason: "provider_pending" };
  if (rawStatus === "SUCCESS") {
    return input.inventoryReleased
      ? { action: "manual_review", reason: "late_success_after_release" }
      : { action: "settle_success", status: "SUCCESS", currency: "TND" };
  }
  if (rawStatus === "FAILURE" || rawStatus === "EXPIRED") {
    return { action: "release_reservation", status: rawStatus, currency: "TND" };
  }
  return { action: "manual_review", reason: "provider_unknown" };
}

export function stableReconciliationEventId(paymentId: string, status: string): string {
  // IDs are deterministic so retries of the same manually verified outcome are idempotent.
  const hash = createHash("sha256").update(`${paymentId}:${status}`).digest("hex");
  return `admin-reconcile-${hash}`;
}
