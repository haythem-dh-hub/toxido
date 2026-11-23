import { NextResponse } from "next/server";
import { getSupabaseSettings } from "@/lib/supabase-server";
import { failFlouciInitialization, flouciGeneratePayment, getFlouciSettings, paymentRpc, validHostedPaymentUrl } from "@/lib/flouci-server";
import { readLimitedBody } from "@/lib/read-limited-body";
import { normalizeTunisiaGovernorate } from "@/features/checkout/tunisia-delivery";

type Customer = { fullName: string; email: string; phone: string; address: string; city: string; governorate: string };
type Item = { slug: string; variantId?: string; quantity: number };
type CreatedOrder = { reference: string; total_millimes: number; payment_status: string; tracking_id: string | null; payment_id: string | null; payment_url: string | null; created: boolean };

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const fail = (code: string, message: string, status = 400) => json({ error: { code, message } }, status);

function normalizeTunisiaPhone(value: unknown): string | null {
  const digits = typeof value === "string" ? value.replace(/[\s().-]/g, "") : "";
  const local = digits.replace(/^\+?216/, "").replace(/^00216/, "");
  return /^\d{8}$/.test(local) ? `+216${local}` : null;
}

function mapOrderError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("INSUFFICIENT_STOCK")) return fail("INSUFFICIENT_STOCK", "There is not enough stock for one or more items.", 409);
  if (message.includes("PRODUCT_UNAVAILABLE")) return fail("PRODUCT_UNAVAILABLE", "One or more items are no longer available.", 409);
  if (message.includes("PROMOTION_UNAVAILABLE")) return fail("PROMOTION_UNAVAILABLE", "The fixed three-fragrance pack is not available.", 409);
  if (message.includes("IDEMPOTENCY_CONFLICT")) return fail("IDEMPOTENCY_CONFLICT", "This checkout was already submitted using a different payment method.", 409);
  return fail("PAYMENT_SERVICE_UNAVAILABLE", "Card checkout is temporarily unavailable. No payment was confirmed.", 503);
}

export async function POST(request: Request) {
  const serviceSettings = getSupabaseSettings(true);
  const flouci = getFlouciSettings();
  if (!serviceSettings || !flouci) return fail("PAYMENT_SERVICE_UNAVAILABLE", "Card checkout is not configured yet.", 503);
  const rawBody = await readLimitedBody(request, 16_384);
  if (!rawBody) return fail("INVALID_ORDER", "The order request is too large.", 413);
  let body: unknown;
  try { body = JSON.parse(rawBody.toString("utf8")) as unknown; } catch { return fail("INVALID_ORDER", "Review your order and try again."); }
  if (!body || typeof body !== "object") return fail("INVALID_ORDER", "Review your order and try again.");
  const input = body as { idempotencyKey?: unknown; customer?: Record<string, unknown>; items?: unknown };
  const customer: Customer = {
    fullName: typeof input.customer?.fullName === "string" ? input.customer.fullName.trim().slice(0, 100) : "",
    email: typeof input.customer?.email === "string" ? input.customer.email.trim().slice(0, 254).toLowerCase() : "",
    phone: normalizeTunisiaPhone(input.customer?.phone) ?? "",
    address: typeof input.customer?.address === "string" ? input.customer.address.trim().slice(0, 250) : "",
    city: typeof input.customer?.city === "string" ? input.customer.city.trim().slice(0, 80) : "",
    governorate: normalizeTunisiaGovernorate(input.customer?.governorate) ?? "",
  };
  const rawItems = Array.isArray(input.items) ? input.items : [];
  const items: Item[] = rawItems.filter((value): value is Item => Boolean(value && typeof value === "object" &&
    typeof (value as Item).slug === "string" && Number.isInteger((value as Item).quantity) &&
    ((value as Item).variantId === undefined || typeof (value as Item).variantId === "string")))
    .map((item) => ({ slug: item.slug, quantity: item.quantity, ...(item.variantId ? { variantId: item.variantId } : {}) }));
  const fixedTrio = items.some((item) => item.slug === "toxido-fixed-trio");
  const uniqueLines = new Set(items.map((item) => `${item.slug}:${item.variantId ?? "default"}`));
  const validEmail = !customer.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(input.idempotencyKey ?? "")) ||
      customer.fullName.length < 2 || !customer.phone || customer.address.length < 5 || customer.city.length < 2 ||
      customer.governorate.length < 2 || !validEmail || rawItems.length < 1 || rawItems.length > 30 || items.length !== rawItems.length ||
      uniqueLines.size !== items.length || items.some((item) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug) || item.quantity < 1 || item.quantity > 50 ||
        (item.slug === "toxido-fixed-trio" ? item.variantId !== undefined : !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.variantId ?? "")))) {
    return fail("INVALID_ORDER", "Enter valid contact and Tunisia delivery details and check item quantities.");
  }
  if (fixedTrio && items.length !== 1) return fail("INVALID_ORDER", "The fixed fragrance pack must be ordered on its own.");

  let order: CreatedOrder;
  try {
    order = await paymentRpc<CreatedOrder>("create_flouci_order", {
      p_idempotency_key: input.idempotencyKey,
      p_customer: customer,
      p_items: items,
      p_fixed_trio: fixedTrio,
    });
  } catch (error) { return mapOrderError(error); }

  if (!order.reference || !order.tracking_id) return fail("PAYMENT_ORDER_INVALID", "The order could not be prepared for card payment.", 503);
  if (order.payment_status === "paid") return json({ data: { reference: order.reference } });
  if (order.payment_status !== "pending") {
    return fail(order.payment_status === "expired" ? "PAYMENT_EXPIRED" : "PAYMENT_FAILED", "This payment attempt has ended. Submit the order again to start a new attempt.", 409);
  }
  if (order.payment_url && order.payment_id && validHostedPaymentUrl(order.payment_url)) {
    return json({ data: { reference: order.reference, paymentUrl: order.payment_url } });
  }
  if (!order.created) return fail("PAYMENT_INITIALIZING", "This payment is already being prepared. Wait briefly before retrying.", 409);

  let providerResponse: Response;
  try {
    providerResponse = await flouciGeneratePayment(flouci, {
      amountMillimes: Number(order.total_millimes),
      trackingId: order.tracking_id,
      successUrl: new URL(`/order-confirmation/${encodeURIComponent(order.reference)}?payment=return`, flouci.siteUrl).toString(),
      failUrl: new URL(`/order-confirmation/${encodeURIComponent(order.reference)}?payment=return`, flouci.siteUrl).toString(),
      webhookUrl: new URL("/api/webhooks/flouci", flouci.siteUrl).toString(),
    });
  } catch {
    // A timeout can be ambiguous; keep the reservation and never create a second payment session automatically.
    return fail("PAYMENT_INIT_UNCERTAIN", "Payment setup could not be confirmed. Please wait before retrying or contact support.", 503);
  }

  const providerBody = await providerResponse.json().catch(() => null) as {
    result?: { success?: boolean; payment_id?: string; link?: string; developer_tracking_id?: string };
  } | null;
  if (!providerResponse.ok || providerBody?.result?.success !== true) {
    try {
      if (!await failFlouciInitialization(order.tracking_id)) {
        return fail("PAYMENT_INIT_UNCERTAIN", "Flouci rejected setup, but inventory release could not be confirmed. Contact support before retrying.", 503);
      }
    } catch { return fail("PAYMENT_INIT_UNCERTAIN", "Inventory release could not be confirmed. Contact support before retrying.", 503); }
    return fail("PAYMENT_INIT_FAILED", "Flouci could not start this payment. You can retry checkout.", 502);
  }
  const paymentId = providerBody.result.payment_id;
  const paymentUrl = providerBody.result.link;
  if (providerBody.result.developer_tracking_id !== order.tracking_id || !paymentId || !validHostedPaymentUrl(paymentUrl)) {
    return fail("PAYMENT_INIT_UNCERTAIN", "Flouci returned an incomplete payment session. Contact support before retrying.", 503);
  }

  try {
    const stored = await paymentRpc<boolean>("record_flouci_payment_session", {
      p_tracking_id: order.tracking_id, p_payment_id: paymentId, p_payment_url: paymentUrl,
    });
    if (!stored) return fail("PAYMENT_INIT_UNCERTAIN", "The payment session could not be saved. Contact support before retrying.", 503);
  } catch {
    return fail("PAYMENT_INIT_UNCERTAIN", "The payment session could not be saved. Contact support before retrying.", 503);
  }
  return json({ data: { reference: order.reference, paymentUrl } });
}
