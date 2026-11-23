import { NextResponse } from "next/server";
import { getSupabaseSettings } from "@/lib/supabase-server";
import { normalizeTunisiaGovernorate } from "@/features/checkout/tunisia-delivery";

type CustomerInput = { fullName: string; email?: string; phone: string; address: string; city: string; governorate: string };
type ItemInput = { slug: string; variantId?: string; quantity: number };

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeTunisiaPhone(value: unknown): string | null {
  const digits = typeof value === "string" ? value.replace(/[\s().-]/g, "") : "";
  const local = digits.replace(/^\+?216/, "").replace(/^00216/, "");
  return /^\d{8}$/.test(local) ? `+216${local}` : null;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 16_384) {
    return json({ error: { code: "INVALID_ORDER", message: "The order request is too large." } }, 413);
  }
  const settings = getSupabaseSettings(true);
  if (!settings?.serviceRoleKey || !settings.serviceRoleKeyKind) {
    return json({ error: { code: "ORDER_SERVICE_UNAVAILABLE", message: "Orders are not available yet. No order was placed." } }, 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: { code: "INVALID_ORDER", message: "Please review your order details and try again." } }, 400);
  }
  if (!body || typeof body !== "object") {
    return json({ error: { code: "INVALID_ORDER", message: "Please review your order details and try again." } }, 400);
  }

  const payload = body as { idempotencyKey?: unknown; customer?: Record<string, unknown>; items?: unknown };
  const key = typeof payload.idempotencyKey === "string" ? payload.idempotencyKey : "";
  const rawCustomer = payload.customer;
  const customer: CustomerInput = {
    fullName: cleanText(rawCustomer?.fullName, 100),
    email: cleanText(rawCustomer?.email, 254).toLowerCase(),
    phone: normalizeTunisiaPhone(rawCustomer?.phone) ?? "",
    address: cleanText(rawCustomer?.address, 250),
    city: cleanText(rawCustomer?.city, 80),
    governorate: normalizeTunisiaGovernorate(rawCustomer?.governorate) ?? "",
  };
  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  const items: ItemInput[] = rawItems.filter((item): item is ItemInput => Boolean(item && typeof item === "object" &&
    typeof (item as ItemInput).slug === "string" && Number.isInteger((item as ItemInput).quantity) &&
    ((item as ItemInput).variantId === undefined || typeof (item as ItemInput).variantId === "string")))
    .map((item) => ({ slug: item.slug, quantity: item.quantity, ...(item.variantId ? { variantId: item.variantId } : {}) }));

  const uniqueLines = new Set(items.map((item) => `${item.slug}:${item.variantId ?? "default"}`));
  const isFixedTrio = items.some((item) => item.slug === "toxido-fixed-trio");
  const validEmail = !customer.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key) ||
      customer.fullName.length < 2 || !customer.phone || customer.address.length < 5 ||
      customer.city.length < 2 || customer.governorate.length < 2 || !validEmail ||
      rawItems.length < 1 || rawItems.length > 30 || items.length !== rawItems.length ||
      uniqueLines.size !== items.length || items.some((item) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug) || item.quantity < 1 || item.quantity > 50 ||
        (item.slug === "toxido-fixed-trio" ? item.variantId !== undefined : !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.variantId ?? "")))) {
    return json({ error: { code: "INVALID_ORDER", message: "Enter valid contact and delivery details and check the quantities in your cart." } }, 400);
  }
  if (isFixedTrio && items.length !== 1) {
    return json({ error: { code: "INVALID_ORDER", message: "The fixed three-fragrance pack must be ordered on its own." } }, 400);
  }

  let response: Response;
  try {
    const rpc = isFixedTrio ? "create_fixed_trio_cod_order" : "create_cod_order";
    const rpcBody = isFixedTrio
      ? { p_idempotency_key: key, p_customer: customer, p_quantity: items[0].quantity }
      : { p_idempotency_key: key, p_customer: customer, p_items: items };
    const headers: Record<string, string> = {
      apikey: settings.serviceRoleKey,
      "Content-Type": "application/json",
    };
    if (settings.serviceRoleKeyKind === "legacy-service-role-jwt") {
      headers.Authorization = `Bearer ${settings.serviceRoleKey}`;
    }

    response = await fetch(new URL(`/rest/v1/rpc/${rpc}`, settings.url), {
      method: "POST",
      headers,
      body: JSON.stringify(rpcBody),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return json({ error: { code: "ORDER_PERSISTENCE_FAILED", message: "We could not confirm that your order was saved. Please retry shortly." } }, 503);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => null) as { message?: string } | null;
    const message = error?.message ?? "";
    if (message.includes("PRODUCT_UNAVAILABLE")) {
      return json({ error: { code: "PRODUCT_UNAVAILABLE", message: "One or more items are no longer available. Your order was not placed." } }, 409);
    }
    if (message.includes("INSUFFICIENT_STOCK")) {
      return json({ error: { code: "INSUFFICIENT_STOCK", message: "There is not enough stock for one or more items. Your order was not placed." } }, 409);
    }
    if (message.includes("PROMOTION_UNAVAILABLE")) {
      return json({ error: { code: "PROMOTION_UNAVAILABLE", message: "The three-fragrance pack is not available yet. Your order was not placed." } }, 409);
    }
    if (message.includes("INVALID_ORDER")) {
      return json({ error: { code: "INVALID_ORDER", message: "Please review your delivery details and try again." } }, 400);
    }
    return json({ error: { code: "ORDER_PERSISTENCE_FAILED", message: "We could not confirm that your order was saved. Please retry shortly." } }, 503);
  }

  const order = await response.json().catch(() => null) as { reference?: string } | null;
  if (!order || typeof order.reference !== "string" || !/^TX-\d{8}-[A-F0-9]{32}$/.test(order.reference)) {
    return json({ error: { code: "ORDER_PERSISTENCE_FAILED", message: "We could not confirm that your order was saved. Please contact support before retrying." } }, 503);
  }
  return json({ data: { reference: order.reference } }, 201);
}
