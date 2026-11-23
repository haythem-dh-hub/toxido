import { createHmac, timingSafeEqual } from "node:crypto";

export type FlouciEvent = {
  event: "payment.succeeded" | "payment.failed";
  event_id: string;
  payment_id: string;
  developer_tracking_id: string;
  amount: number;
  currency: string;
  payment_method: string;
};

export type FlouciVerification = {
  success: boolean;
  result?: {
    status?: string;
    amount?: number | string;
    currency?: string;
    type?: string;
    developer_tracking_id?: string | null;
  };
};

export function verifyFlouciSignature(rawBody: Uint8Array, header: string | null, secret: string, now = Date.now()): boolean {
  if (!header || !secret) return false;
  const match = /^t=(\d{10,13}),v1=([a-f0-9]{64})$/i.exec(header.trim());
  if (!match) return false;
  const timestamp = Number(match[1]);
  const timestampMs = match[1].length === 13 ? timestamp : timestamp * 1000;
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestampMs) > 5 * 60_000) return false;
  const expected = createHmac("sha256", secret).update(`${match[1]}.`).update(rawBody).digest();
  const received = Buffer.from(match[2], "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function validateVerifiedFlouciEvent(event: FlouciEvent, verification: FlouciVerification) {
  if (!event || !verification || verification.success !== true || !verification.result) return null;
  const result = verification.result;
  const amount = typeof result.amount === "string" && /^\d+$/.test(result.amount)
    ? Number(result.amount)
    : result.amount;
  if (!Number.isSafeInteger(event.amount) || !Number.isSafeInteger(amount) || event.amount !== amount ||
      event.currency !== "TND" || (result.currency !== undefined && result.currency !== "TND") ||
      event.developer_tracking_id !== result.developer_tracking_id ||
      !event.event_id || !event.payment_id || !event.developer_tracking_id) return null;

  if (event.event === "payment.succeeded" && result.status === "SUCCESS" &&
      event.payment_method === "card" && result.type === "card") return { status: "SUCCESS" as const };
  if (event.event === "payment.failed" && ["FAILURE", "EXPIRED", "SYSTEM_FAILURE"].includes(result.status ?? "")) {
    const methodMatches = (event.payment_method === "card" && result.type === "card") ||
      (event.payment_method === "NA" && result.type === "NA");
    if (!methodMatches) return null;
    return { status: result.status === "EXPIRED" ? "EXPIRED" as const : "FAILURE" as const };
  }
  return null;
}
