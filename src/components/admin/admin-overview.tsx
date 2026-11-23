"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type OverviewData = {
  totalOrders: number; pendingOrders: number; confirmedOrders: number; completedOrders: number;
  fulfilledRevenueMillimes: string; lowStockThreshold: number | null;
  lowStock: { product: string; slug: string; variant: string; sku: string; stock: number }[];
};

function money(millimes: string) {
  const value = BigInt(millimes);
  const divisor = BigInt(1000);
  return `${value / divisor}.${(value % divisor).toString().padStart(3, "0")} TND`;
}

export function AdminOverview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    fetch("/api/admin/overview", { cache: "no-store" }).then(async (response) => {
      const result = await response.json() as OverviewData & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Dashboard data is unavailable.");
      if (mounted) setData(result);
    }).catch((reason: unknown) => { if (mounted) setError(reason instanceof Error ? reason.message : "Dashboard data is unavailable."); });
    return () => { mounted = false; };
  }, []);

  const metrics = data ? [
    ["All orders", data.totalOrders],
    ["Pending", data.pendingOrders],
    ["Confirmed", data.confirmedOrders],
    ["Completed", data.completedOrders],
  ] as const : [];

  return (
    <div>
      <p className="type-eyebrow text-gold">Store operations</p>
      <h1 className="type-heading mt-3 text-ivory">Overview</h1>
      <p className="mt-3 text-sm text-muted">Order and catalog health from the live store database.</p>
      {error ? <p role="alert" className="mt-7 border border-red-400/40 bg-red-950/30 p-4 text-sm text-red-200">{error}</p> : null}
      {!data && !error ? <p className="mt-8 text-sm text-muted">Loading dashboard…</p> : null}
      {data ? <>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(([label, value]) => <article key={label} className="border border-gold-muted/40 bg-charcoal p-5">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.17em] text-muted">{label}</p>
            <p className="mt-3 font-toxido-display text-4xl text-ivory">{value.toLocaleString()}</p>
          </article>)}
        </div>
        <article className="mt-4 border border-gold-muted/40 bg-charcoal p-5 sm:p-6">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.17em] text-muted">Fulfilled order revenue</p>
          <p className="mt-2 font-toxido-display text-4xl text-gold">{money(data.fulfilledRevenueMillimes)}</p>
          <p className="mt-2 text-xs text-muted">Calculated from orders with status “fulfilled”, using stored total millimes.</p>
        </article>
        <section className="mt-8 border border-gold-muted/40 bg-charcoal p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="type-eyebrow text-gold">Inventory attention</p><h2 className="type-title mt-2 text-ivory">Low-stock variants</h2></div>
            {data.lowStockThreshold !== null ? <p className="text-xs text-muted">Threshold: {data.lowStockThreshold} units</p> : null}
          </div>
          {data.lowStockThreshold === null ? <p className="mt-5 text-sm text-muted">Set the server-side `ADMIN_LOW_STOCK_THRESHOLD` value to enable this list.</p> :
            data.lowStock.length === 0 ? <p className="mt-5 text-sm text-muted">No variants are at or below the configured threshold.</p> :
              <ul className="mt-5 divide-y divide-smoke">{data.lowStock.map((item) => <li key={item.sku} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <span className="text-ivory">{item.product} <span className="text-muted">· {item.variant} · {item.sku}</span></span><span className="text-gold">{item.stock} in stock</span>
              </li>)}</ul>}
        </section>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/admin/orders" className="min-h-11 border border-gold px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-gold hover:bg-gold/10">Review orders</Link>
          <Link href="/admin/products" className="min-h-11 border border-smoke px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-silver-bright hover:border-gold-muted">Manage products</Link>
        </div>
      </> : null}
    </div>
  );
}
