export interface CheckoutSubmission {
  idempotencyKey: string;
  customer: { fullName: string; email: string; phone: string; address: string; city: string; governorate: string };
  items: { slug: string; variantId?: string; quantity: number }[];
}

export type OrderSubmissionResponse =
  | { data: { reference: string }; error?: never }
  | { data?: never; error: { code: string; message: string } };

export type FlouciSubmissionResponse =
  | { data: { reference: string; paymentUrl?: string }; error?: never }
  | { data?: never; error: { code: string; message: string } };

export async function startFlouciPayment(submission: CheckoutSubmission): Promise<FlouciSubmissionResponse> {
  const response = await fetch("/api/payments/flouci/initiate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submission),
  });
  const body = await response.json().catch(() => null) as FlouciSubmissionResponse | null;
  if (!response.ok || !body || body.error) {
    return body?.error ? body : { error: { code: "PAYMENT_INIT_FAILED", message: "Secure payment could not be started. No payment was confirmed." } };
  }
  return body;
}

export async function submitOrder(submission: CheckoutSubmission): Promise<OrderSubmissionResponse> {
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submission),
  });
  const body = await response.json().catch(() => null) as OrderSubmissionResponse | null;
  if (!response.ok || !body || body.error) {
    return body?.error ? body : { error: { code: "ORDER_REQUEST_FAILED", message: "We could not confirm that your order was saved. Please retry shortly." } };
  }
  return body;
}
