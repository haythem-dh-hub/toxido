import "server-only";

import { adminRest } from "@/lib/admin-rest";
import { flouciVerifyPayment, getFlouciSettings, paymentRpc, type FlouciSettings } from "@/lib/flouci-server";
import { decideFlouciReconciliation, stableReconciliationEventId, type ReconciliationDecision } from "@/features/payments/flouci-reconciliation";
import type { FlouciVerification } from "@/features/payments/flouci-security";

export const FLOUCI_SESSION_TIMEOUT_MS = 20 * 60_000;

export type AbandonedOrderCandidate = {
  id: string;
  reference: string;
  flouci_tracking_id: string;
  flouci_payment_id: string | null;
  total_millimes: number | string;
  inventory_released_at: string | null;
  created_at: string;
};

export type AbandonedReconciliationOutcome = {
  orderId: string;
  reference: string;
  trackingId: string;
  action: "released" | "settled" | "kept_pending" | "flagged_review" | "skipped_active" | "error";
  reason?: string;
};

export type AbandonedReconciliationReport = {
  scanned: number;
  expiredAndReleased: number;
  settledPaid: number;
  keptPending: number;
  flaggedReview: number;
  skippedActive: number;
  errors: number;
  outcomes: AbandonedReconciliationOutcome[];
};

export async function processAbandonedOrder(
  order: AbandonedOrderCandidate,
  settings: FlouciSettings,
  now = Date.now(),
): Promise<AbandonedReconciliationOutcome> {
  const ageMs = now - new Date(order.created_at).getTime();
  if (!Number.isFinite(ageMs) || ageMs < FLOUCI_SESSION_TIMEOUT_MS) {
    return {
      orderId: order.id,
      reference: order.reference,
      trackingId: order.flouci_tracking_id,
      action: "skipped_active",
      reason: "Session window has not elapsed; stock remains reserved.",
    };
  }

  if (!order.flouci_payment_id) {
    // Missing payment ID cannot be verified automatically. Never release stock based on timeout.
    try {
      await paymentRpc<boolean>("flag_flouci_payment_review", {
        p_tracking_id: order.flouci_tracking_id,
        p_reason: "payment_id_missing",
      });
      return {
        orderId: order.id,
        reference: order.reference,
        trackingId: order.flouci_tracking_id,
        action: "flagged_review",
        reason: "No payment ID recorded. Flagged for manual review; stock remains held.",
      };
    } catch {
      return {
        orderId: order.id,
        reference: order.reference,
        trackingId: order.flouci_tracking_id,
        action: "error",
        reason: "Failed to record manual review state; stock remains held.",
      };
    }
  }

  let verification: FlouciVerification | null = null;
  try {
    const response = await flouciVerifyPayment(settings, order.flouci_payment_id);
    if (response.ok) {
      verification = (await response.json().catch(() => null)) as FlouciVerification | null;
    }
  } catch {
    // Provider verification network error or timeout. Stock must remain reserved.
    return {
      orderId: order.id,
      reference: order.reference,
      trackingId: order.flouci_tracking_id,
      action: "error",
      reason: "Provider verification network error. Stock remains held.",
    };
  }

  if (!verification || !verification.success || !verification.result) {
    // Provider verification failed or returned unexpected body. Stock remains held.
    try {
      await paymentRpc<boolean>("flag_flouci_payment_review", {
        p_tracking_id: order.flouci_tracking_id,
        p_reason: "provider_status_unknown",
      });
    } catch { /* stock remains held */ }
    return {
      orderId: order.id,
      reference: order.reference,
      trackingId: order.flouci_tracking_id,
      action: "flagged_review",
      reason: "Unverified provider response. Flagged for review; stock remains held.",
    };
  }

  const decision: ReconciliationDecision = decideFlouciReconciliation({
    verification,
    expectedTrackingId: order.flouci_tracking_id,
    expectedAmountMillimes: Number(order.total_millimes),
    paymentId: order.flouci_payment_id,
    inventoryReleased: Boolean(order.inventory_released_at),
    currencyConfirmedByAdmin: false,
  });

  if (decision.action === "keep_pending") {
    return {
      orderId: order.id,
      reference: order.reference,
      trackingId: order.flouci_tracking_id,
      action: "kept_pending",
      reason: "Provider reported PENDING. Stock remains reserved.",
    };
  }

  if (decision.action === "manual_review") {
    const reviewReason = decision.reason === "late_success_after_release"
      ? "late_success_after_stock_release"
      : decision.reason === "identity_mismatch"
        ? "identity_mismatch"
        : decision.reason === "currency_unconfirmed"
          ? "currency_unconfirmed"
          : "provider_status_unknown";
    try {
      await paymentRpc<boolean>("flag_flouci_payment_review", {
        p_tracking_id: order.flouci_tracking_id,
        p_reason: reviewReason,
      });
    } catch { /* stock unchanged */ }
    return {
      orderId: order.id,
      reference: order.reference,
      trackingId: order.flouci_tracking_id,
      action: "flagged_review",
      reason: `Provider verification requires review (${decision.reason}). Stock remains held unless previously released.`,
    };
  }

  const status = decision.status;
  const eventId = stableReconciliationEventId(order.flouci_payment_id, status);
  try {
    const result = await paymentRpc<{ accepted: boolean; duplicate: boolean; payment_status: string; reconciliation_required?: boolean }>(
      "settle_flouci_payment_event",
      {
        p_event_id: eventId,
        p_event_type: status === "SUCCESS" ? "payment.succeeded" : "payment.failed",
        p_payment_id: order.flouci_payment_id,
        p_tracking_id: order.flouci_tracking_id,
        p_amount_millimes: Number(order.total_millimes),
        p_currency: decision.currency,
        p_verified_status: status,
      },
    );

    if (!result.accepted) {
      return {
        orderId: order.id,
        reference: order.reference,
        trackingId: order.flouci_tracking_id,
        action: "error",
        reason: "Failed to apply verified status in database.",
      };
    }

    if (status === "SUCCESS") {
      return {
        orderId: order.id,
        reference: order.reference,
        trackingId: order.flouci_tracking_id,
        action: result.reconciliation_required ? "flagged_review" : "settled",
        reason: result.reconciliation_required
          ? "Late payment success after release. Order cancelled for manual resolution."
          : "Flouci confirmed successful payment. Order marked paid.",
      };
    }

    return {
      orderId: order.id,
      reference: order.reference,
      trackingId: order.flouci_tracking_id,
      action: "released",
      reason: `Flouci verified terminal ${status}. Stock released once.`,
    };
  } catch {
    return {
      orderId: order.id,
      reference: order.reference,
      trackingId: order.flouci_tracking_id,
      action: "error",
      reason: "Database error during settlement; stock was not changed.",
    };
  }
}

export async function reconcileAbandonedFlouciSessions(
  limit = 20,
): Promise<AbandonedReconciliationReport> {
  const settings = getFlouciSettings();
  if (!settings) {
    throw new Error("FLOUCI_NOT_CONFIGURED");
  }

  const cutoff = new Date(Date.now() - FLOUCI_SESSION_TIMEOUT_MS).toISOString();
  const query = new URLSearchParams({
    payment_method: "eq.flouci",
    payment_status: "eq.pending",
    created_at: `lte.${cutoff}`,
    select: "id,reference,flouci_tracking_id,flouci_payment_id,total_millimes,inventory_released_at,created_at",
    order: "created_at.asc",
    limit: String(Math.min(limit, 50)),
  });

  const response = await adminRest(`orders?${query.toString()}`);
  if (!response.ok) {
    throw new Error("FAILED_TO_FETCH_PENDING_ORDERS");
  }

  const orders = (await response.json()) as AbandonedOrderCandidate[];
  const report: AbandonedReconciliationReport = {
    scanned: orders.length,
    expiredAndReleased: 0,
    settledPaid: 0,
    keptPending: 0,
    flaggedReview: 0,
    skippedActive: 0,
    errors: 0,
    outcomes: [],
  };

  for (const order of orders) {
    const outcome = await processAbandonedOrder(order, settings);
    report.outcomes.push(outcome);
    switch (outcome.action) {
      case "released":
        report.expiredAndReleased += 1;
        break;
      case "settled":
        report.settledPaid += 1;
        break;
      case "kept_pending":
        report.keptPending += 1;
        break;
      case "flagged_review":
        report.flaggedReview += 1;
        break;
      case "skipped_active":
        report.skippedActive += 1;
        break;
      case "error":
        report.errors += 1;
        break;
    }
  }

  return report;
}
