import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseSettings, normalizeWhatsAppNumber } from "@/lib/supabase-server";
import { ClearCartOnPaidOrder } from "@/components/cart/clear-cart-on-paid";
import { PendingPaymentPoller } from "@/components/cart/pending-payment-poller";

export const dynamic = "force-dynamic";

type PublicOrder = { reference: string; status: string; total_millimes: number; currency: "TND"; payment_method: "cash_on_delivery" | "flouci"; payment_status: "cod_due" | "pending" | "paid" | "failed" | "expired" | "review_required" };

export default async function OrderConfirmationPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  if (!/^TX-\d{8}-[A-F0-9]{32}$/.test(reference)) notFound();

  const settings = getSupabaseSettings();
  let response: Response | null = null;
  if (settings) {
    response = await fetch(new URL("/rest/v1/rpc/get_public_order", settings.url), {
      method: "POST",
      headers: { apikey: settings.anonKey, Authorization: `Bearer ${settings.anonKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_reference: reference }),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    }).catch(() => null);
  }
  const order = response?.ok ? await response.json().catch(() => null) as PublicOrder | null : null;
  if (response?.ok && !order) notFound();
  if (order && (order.reference !== reference || order.currency !== "TND")) notFound();

  const whatsappNumber = normalizeWhatsAppNumber();
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Hello TOXIDO, I am following up on order ${reference}.` )}`
    : null;
  const total = order
    ? new Intl.NumberFormat("fr-TN", { style: "currency", currency: "TND", maximumFractionDigits: 3 }).format(order.total_millimes / 1000)
    : null;
  const isCod = order?.payment_method === "cash_on_delivery";
  const paymentLabel = !order ? "" : isCod ? "Cash on Delivery" : order.payment_status === "paid" ? "Card payment confirmed" : `Card payment ${order.payment_status.replaceAll("_", " ")}`;
  const heading = !order ? "We couldn't retrieve the order." : isCod || order.payment_status === "paid" ? "Thank you." : "Payment update";
  const eyebrow = !order ? "Confirmation temporarily unavailable" : isCod ? "Order saved · Cash on Delivery" : paymentLabel;
  const message = !order
    ? "Keep this reference and contact support before retrying. We could not verify the order status just now."
    : isCod ? "Your order is recorded. Keep this reference for your records."
      : order.payment_status === "paid" ? "Flouci confirmed your payment. Keep this reference for your records."
      : order.payment_status === "review_required" ? "Your payment is under manual review. Do not place the order again; support will review the payment and contact you."
        : order.payment_status === "pending" ? "Your payment is awaiting server confirmation. This page does not confirm payment; refresh in a moment or contact support if the status remains pending."
          : "Flouci verified that this payment did not complete. No payment was recorded for this order. You can return to your cart and try again.";

  return (
    <section className="section-space page-gutter bg-ink">
      <div className="site-container mx-auto max-w-2xl border border-gold-muted/50 bg-charcoal p-8 text-center sm:p-12">
        {order?.payment_method === "flouci" && order.payment_status === "paid" ? <ClearCartOnPaidOrder /> : null}
        <p className="type-eyebrow text-gold">{eyebrow}</p>
        <h1 className="type-heading mt-5 text-ivory">{heading}</h1>
        <p className="mt-5 text-sm leading-7 text-silver-bright">{message}</p>
        {order?.payment_method === "flouci" && order.payment_status === "pending" ? (
          <PendingPaymentPoller reference={reference} />
        ) : null}
        <dl className="mx-auto mt-8 grid max-w-sm gap-4 border-y border-smoke py-5 text-left text-sm">
          <div className="flex justify-between gap-4"><dt className="text-muted">Order reference</dt><dd className="font-semibold tracking-wider text-ivory">{reference}</dd></div>
          {total ? <div className="flex justify-between gap-4"><dt className="text-muted">Order total</dt><dd className="text-ivory">{total}</dd></div> : null}
          {order ? <div className="flex justify-between gap-4"><dt className="text-muted">Payment</dt><dd className="text-ivory">{paymentLabel}</dd></div> : null}
        </dl>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {whatsappHref ? <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center border border-gold-muted px-5 text-xs font-bold uppercase tracking-wider text-gold transition-colors hover:border-gold hover:bg-gold hover:text-ink">Contact us on WhatsApp</a> : null}
        {order?.payment_method === "flouci" && ["failed", "expired"].includes(order.payment_status) ? <Link href="/cart" className="inline-flex min-h-11 items-center justify-center border border-gold-muted px-5 text-xs font-bold uppercase tracking-wider text-gold">Return to cart</Link> : null}
          <Link href="/" className="inline-flex min-h-11 items-center justify-center border border-silver-bright bg-ivory px-5 text-xs font-bold uppercase tracking-wider text-ink">Return to storefront</Link>
        </div>
      </div>
    </section>
  );
}
