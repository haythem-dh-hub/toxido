"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DATABASE_ORDER_STATUSES, type DatabaseOrderStatus } from "@/features/admin/admin-security";

type Order = { id: string; reference: string; status: DatabaseOrderStatus; customer_name: string; customer_email: string | null; customer_phone: string; delivery_address: string; delivery_city: string; delivery_governorate: string; payment_method: string; payment_status: "cod_due" | "pending" | "paid" | "failed" | "expired" | "review_required"; shipping_millimes: string | number; total_millimes: string | number; discount_millimes?: string | number; promotion_code?: string | null; created_at: string; flouci_tracking_id: string | null; flouci_payment_id: string | null; inventory_released_at: string | null; flouci_review_reason: string | null };
type Item = { id: string; product_name: string; product_slug: string; brand_name: string; variant_name: string; sku: string; image_url: string | null; unit_price_millimes: string | number; quantity: number; line_total_millimes: string | number; promotion_code?: string | null };
type Details = { order: Order; items: Item[] };
const money = (millimes: string | number) => { const value = BigInt(millimes); const divisor = BigInt(1000); return `${value / divisor}.${(value % divisor).toString().padStart(3, "0")} TND`; };
const label = (status: string) => status === "fulfilled" ? "Completed" : status.charAt(0).toUpperCase() + status.slice(1);

export function AdminOrderDetail({ id }: { id: string }) {
  const [details, setDetails] = useState<Details | null>(null);
  const [status, setStatus] = useState<DatabaseOrderStatus>("pending");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [paymentId, setPaymentId] = useState("");
  const [currencyConfirmedTnd, setCurrencyConfirmedTnd] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconciliationMessage, setReconciliationMessage] = useState("");
  const [reconciliationError, setReconciliationError] = useState("");

  useEffect(() => { let alive = true; fetch(`/api/admin/orders/${encodeURIComponent(id)}`, { cache: "no-store" }).then(async (response) => {
    const result = await response.json() as Details & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Order details are unavailable.");
    if (alive) { setDetails(result); setStatus(result.order.status); setPaymentId(result.order.flouci_payment_id ?? ""); }
  }).catch((reason: unknown) => { if (alive) setError(reason instanceof Error ? reason.message : "Order details are unavailable."); }); return () => { alive = false; }; }, [id]);

  async function saveStatus() {
    setSaving(true); setMessage(""); setError("");
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const result = await response.json() as { order?: { status: DatabaseOrderStatus }; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Status could not be saved.");
      if (details && result.order) setDetails({ ...details, order: { ...details.order, status: result.order.status } });
      setMessage("Order status updated.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Status could not be saved."); }
    finally { setSaving(false); }
  }

  async function reconcilePayment() {
    setReconciling(true); setReconciliationMessage(""); setReconciliationError("");
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(id)}/reconcile-payment`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: paymentId.trim() || undefined, currencyConfirmedTnd }),
      });
      const result = await response.json() as { data?: { payment_status?: Order["payment_status"]; message?: string; history?: { match_count: number; truncated: boolean; candidates: { status: string | null; amount_millimes: number | null; type: string | null; created_at: string | null }[] } }; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error ?? "Payment reconciliation could not be completed.");
      setReconciliationMessage([
        result.data.message,
        result.data.history ? `Tracking-ID history matches: ${result.data.history.match_count}${result.data.history.truncated ? " (search reached its safe page limit)" : ""}.` : "",
        result.data.history?.candidates.map((candidate) => `${candidate.status ?? "unknown"} · ${candidate.amount_millimes ?? "amount unavailable"} millimes · ${candidate.type ?? "type unavailable"}`).join("; ") ?? "",
      ].filter(Boolean).join(" "));
      const refreshed = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, { cache: "no-store" });
      if (refreshed.ok) {
        const updated = await refreshed.json() as Details;
        setDetails(updated); setStatus(updated.order.status); setPaymentId(updated.order.flouci_payment_id ?? paymentId);
      }
    } catch (reason) { setReconciliationError(reason instanceof Error ? reason.message : "Payment reconciliation could not be completed."); }
    finally { setReconciling(false); }
  }

  if (error && !details) return <p role="alert" className="border border-red-400/40 p-4 text-sm text-red-200">{error}</p>;
  if (!details) return <p className="text-sm text-muted">Loading order…</p>;
  const order = details.order;
  return <div>
    <Link href="/admin/orders" className="text-xs uppercase tracking-wider text-gold hover:text-ivory">← Orders</Link>
    <p className="type-eyebrow mt-6 text-gold">Order detail</p><h1 className="type-heading mt-2 break-all text-ivory">{order.reference}</h1>
    <div className="mt-7 grid gap-5 xl:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <section className="border border-smoke bg-charcoal p-5 sm:p-6"><h2 className="type-title text-ivory">Customer and delivery</h2>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2 text-sm">
            <div><dt className="text-xs uppercase tracking-wider text-muted">Name</dt><dd className="mt-1 text-ivory">{order.customer_name}</dd></div>
            <div><dt className="text-xs uppercase tracking-wider text-muted">Phone</dt><dd className="mt-1 text-ivory">{order.customer_phone}</dd></div>
            <div><dt className="text-xs uppercase tracking-wider text-muted">Email</dt><dd className="mt-1 break-all text-ivory">{order.customer_email || "—"}</dd></div>
            <div><dt className="text-xs uppercase tracking-wider text-muted">Address</dt><dd className="mt-1 text-ivory">{order.delivery_address}, {order.delivery_city}, {order.delivery_governorate}</dd></div>
            <div><dt className="text-xs uppercase tracking-wider text-muted">Payment</dt><dd className="mt-1 text-ivory">{order.payment_method.replaceAll("_", " ")}</dd></div>
            <div><dt className="text-xs uppercase tracking-wider text-muted">Payment status</dt><dd className="mt-1 text-ivory">{order.payment_status.replaceAll("_", " ")}</dd></div>
            <div><dt className="text-xs uppercase tracking-wider text-muted">Placed</dt><dd className="mt-1 text-ivory">{new Date(order.created_at).toLocaleString()}</dd></div>
          </dl>
        </section>
        <section className="border border-smoke bg-charcoal p-5 sm:p-6"><h2 className="type-title text-ivory">Order item snapshots</h2>
          <ul className="mt-4 divide-y divide-smoke">{details.items.map((item) => <li key={item.id} className="flex flex-wrap justify-between gap-4 py-4 text-sm">
            <div><p className="text-ivory">{item.product_name} · {item.variant_name}</p><p className="mt-1 text-xs text-muted">{item.brand_name} · {item.sku} · Qty {item.quantity}{item.promotion_code ? ` · ${item.promotion_code}` : ""}</p></div>
            <p className="text-right text-silver-bright">{money(item.unit_price_millimes)} each<br /><span className="font-semibold text-ivory">{money(item.line_total_millimes)}</span></p>
          </li>)}</ul>
        </section>
      </div>
      <aside className="h-fit border border-gold-muted/40 bg-charcoal p-5">
        <p className="text-xs uppercase tracking-wider text-muted">Order total</p><p className="mt-2 font-toxido-display text-3xl text-gold">{money(order.total_millimes)}</p>
        <p className="mt-2 text-xs text-muted">Delivery fee: {money(order.shipping_millimes)}</p>
        {order.discount_millimes && BigInt(order.discount_millimes) > BigInt(0) ? <p className="mt-2 text-xs text-muted">Promotion: {order.promotion_code ?? "—"} · {money(order.discount_millimes)}</p> : null}
        <label htmlFor="order-status" className="mt-6 block text-xs uppercase tracking-wider text-silver-bright">Status</label>
        <select id="order-status" value={status} onChange={(event) => setStatus(event.target.value as DatabaseOrderStatus)} className="mt-2 min-h-11 w-full border border-smoke bg-ink px-3 text-sm text-ivory">
          {DATABASE_ORDER_STATUSES.map((value) => <option key={value} value={value}>{label(value)}</option>)}
        </select>
        <button type="button" disabled={saving || status === order.status} onClick={saveStatus} className="mt-3 min-h-11 w-full border border-gold px-4 text-xs font-bold uppercase tracking-wider text-gold hover:bg-gold/10 disabled:opacity-45">{saving ? "Saving…" : "Save status"}</button>
        {message ? <p role="status" className="mt-3 text-sm text-emerald-300">{message}</p> : null}
        {error ? <p role="alert" className="mt-3 text-sm text-red-300">{error}</p> : null}
      </aside>
    </div>
    {order.payment_method === "flouci" && order.payment_status !== "paid" ? <section className="mt-6 border border-gold-muted/50 bg-charcoal p-5 sm:p-6">
      <p className="type-eyebrow text-gold">Flouci reconciliation</p>
      <h2 className="type-title mt-2 text-ivory">Manual payment review</h2>
      <p className="mt-3 text-sm leading-6 text-muted">Reconciliation is admin-only. For sessions with no saved payment ID, the server searches Flouci’s documented transaction history by tracking ID. If a payment ID is missing, retrieve it from the merchant dashboard and enter it below. The server verifies the ID, order tracking ID, card type, amount and status. The verification response may omit currency, so confirm TND in the merchant dashboard before settlement. Uncertain states keep stock reserved. A successful payment after stock release stays cancelled for manual customer/refund resolution.</p>
      <p className="mt-3 break-all text-xs text-silver-bright">Tracking ID: {order.flouci_tracking_id ?? "unavailable"} · Reservation: {order.inventory_released_at ? "released" : "held"}{order.flouci_review_reason ? ` · Review: ${order.flouci_review_reason.replaceAll("_", " ")}` : ""}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
        <label className="text-xs uppercase tracking-wider text-muted">Flouci payment ID
          <input value={paymentId} onChange={(event) => setPaymentId(event.target.value)} maxLength={200} autoComplete="off" className="mt-2 min-h-11 w-full border border-smoke bg-ink px-3 text-sm normal-case tracking-normal text-ivory" placeholder="Leave blank to search history" />
        </label>
        <button type="button" disabled={reconciling || (Boolean(paymentId.trim()) && !currencyConfirmedTnd)} onClick={reconcilePayment} className="self-end min-h-11 border border-gold px-5 text-xs font-bold uppercase tracking-wider text-gold disabled:opacity-45">{reconciling ? "Checking…" : "Check with Flouci"}</button>
      </div>
      {paymentId.trim() ? <label className="mt-3 flex gap-2 text-sm text-silver-bright"><input type="checkbox" checked={currencyConfirmedTnd} onChange={(event) => setCurrencyConfirmedTnd(event.target.checked)} />I confirmed this transaction is in TND in the Flouci merchant dashboard.</label> : null}
      {reconciliationMessage ? <p role="status" className="mt-3 text-sm text-emerald-200">{reconciliationMessage}</p> : null}
      {reconciliationError ? <p role="alert" className="mt-3 text-sm text-red-300">{reconciliationError}</p> : null}
    </section> : null}
  </div>;
}
