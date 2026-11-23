"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DATABASE_ORDER_STATUSES, type DatabaseOrderStatus } from "@/features/admin/admin-security";

type Order = { id: string; reference: string; status: DatabaseOrderStatus; customer_name: string; customer_phone: string; delivery_city: string; delivery_governorate: string; total_millimes: string | number; created_at: string };
const label = (status: string) => status === "fulfilled" ? "Completed" : status.charAt(0).toUpperCase() + status.slice(1);
const money = (millimes: string | number) => { const value = BigInt(millimes); const divisor = BigInt(1000); return `${value / divisor}.${(value % divisor).toString().padStart(3, "0")} TND`; };

export function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (search.trim()) params.set("q", search.trim());
      setLoading(true);
      fetch(`/api/admin/orders?${params}`, { cache: "no-store" }).then(async (response) => {
        const result = await response.json() as { orders?: Order[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Orders are unavailable.");
        if (alive) { setOrders(result.orders ?? []); setError(""); }
      }).catch((reason: unknown) => { if (alive) setError(reason instanceof Error ? reason.message : "Orders are unavailable."); })
        .finally(() => { if (alive) setLoading(false); });
    }, 180);
    return () => { alive = false; clearTimeout(timer); };
  }, [status, search]);

  return <div>
    <p className="type-eyebrow text-gold">Customer operations</p><h1 className="type-heading mt-3 text-ivory">Orders</h1>
    <p className="mt-3 text-sm text-muted">Search and filter the latest 500 orders. Order item snapshots remain unchanged.</p>
    <div className="mt-7 grid gap-3 sm:grid-cols-[1fr_220px]">
      <label className="sr-only" htmlFor="order-search">Search orders</label>
      <input id="order-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Reference, customer, phone or city" className="min-h-12 border border-smoke bg-charcoal px-4 text-sm text-ivory placeholder:text-muted" />
      <label className="sr-only" htmlFor="order-status-filter">Filter by status</label>
      <select id="order-status-filter" value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-12 border border-smoke bg-charcoal px-4 text-sm text-ivory">
        <option value="">All statuses</option>{DATABASE_ORDER_STATUSES.map((value) => <option key={value} value={value}>{label(value)}</option>)}
      </select>
    </div>
    {error ? <p role="alert" className="mt-5 border border-red-400/40 p-4 text-sm text-red-200">{error}</p> : null}
    {loading ? <p className="mt-6 text-sm text-muted">Loading orders…</p> : null}
    {!loading && !error && orders.length === 0 ? <p className="mt-6 border border-smoke p-6 text-sm text-muted">No matching orders.</p> : null}
    {orders.length > 0 ? <div className="mt-6 overflow-x-auto border border-smoke">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead className="bg-charcoal text-[0.65rem] uppercase tracking-wider text-muted"><tr><th className="p-4">Reference</th><th className="p-4">Customer</th><th className="p-4">Delivery</th><th className="p-4">Status</th><th className="p-4 text-right">Total</th><th className="p-4">Date</th></tr></thead>
        <tbody>{orders.map((order) => <tr key={order.id} className="border-t border-smoke hover:bg-charcoal/70">
          <td className="p-4"><Link href={`/admin/orders/${order.id}`} className="font-semibold text-gold hover:text-ivory">{order.reference}</Link></td>
          <td className="p-4 text-ivory">{order.customer_name}<span className="mt-1 block text-xs text-muted">{order.customer_phone}</span></td>
          <td className="p-4 text-silver-bright">{order.delivery_city}, {order.delivery_governorate}</td>
          <td className="p-4 text-silver-bright">{label(order.status)}</td>
          <td className="p-4 text-right text-ivory">{money(order.total_millimes)}</td>
          <td className="p-4 text-xs text-muted">{new Date(order.created_at).toLocaleDateString()}</td>
        </tr>)}</tbody>
      </table>
    </div> : null}
  </div>;
}
