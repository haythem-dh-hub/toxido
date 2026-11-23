"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Variant = { id: string; name: string; sku: string; price_millimes: string | number; stock: number; is_default: boolean; is_active: boolean };
type Product = { id: string; slug: string; name: string; brand: string; category: string; images: { url: string }[]; is_active: boolean; product_variants: Variant[] };

export function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/products", { cache: "no-store" });
      const data = await response.json() as { products?: Product[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Product list is unavailable.");
      setProducts(data.products ?? []); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Product list is unavailable."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    fetch("/api/admin/products", { cache: "no-store" }).then(async (response) => {
      const data = await response.json() as { products?: Product[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Product list is unavailable.");
      if (active) { setProducts(data.products ?? []); setError(""); }
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Product list is unavailable."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function setActive(product: Product) {
    setError("");
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: !product.is_active }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Product status could not be updated.");
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Product status could not be updated."); }
  }

  return <div>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="type-eyebrow text-gold">Catalog operations</p><h1 className="type-heading mt-3 text-ivory">Products</h1><p className="mt-3 text-sm text-muted">Product images are local image paths stored in the database.</p></div>
      <Link href="/admin/products/new" className="min-h-11 border border-gold px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-gold hover:bg-gold/10">Add product</Link>
    </div>
    {error ? <p role="alert" className="mt-6 border border-red-400/40 p-4 text-sm text-red-200">{error}</p> : null}
    {loading ? <p className="mt-6 text-sm text-muted">Loading products…</p> : null}
    {!loading && products.length === 0 && !error ? <p className="mt-6 border border-smoke p-6 text-sm text-muted">No products found.</p> : null}
    <div className="mt-6 grid gap-4">{products.map((product) => <article key={product.id} className="border border-smoke bg-charcoal p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0"><p className="text-[0.65rem] uppercase tracking-wider text-gold">{product.category} · {product.slug}</p><h2 className="type-title mt-2 text-ivory">{product.name}</h2><p className="mt-1 text-sm text-muted">{product.brand} · {product.product_variants.length} variants</p></div>
        <div className="flex gap-2"><Link href={`/admin/products/${product.id}`} className="min-h-10 border border-smoke px-4 py-2 text-xs uppercase tracking-wider text-silver-bright hover:border-gold-muted">Edit</Link>
          <button type="button" onClick={() => void setActive(product)} className={`min-h-10 border px-4 py-2 text-xs uppercase tracking-wider ${product.is_active ? "border-red-400/50 text-red-200 hover:bg-red-950/30" : "border-gold-muted text-gold hover:bg-gold/10"}`}>{product.is_active ? "Deactivate" : "Activate"}</button></div>
      </div>
      {product.product_variants.length ? <ul className="mt-4 grid gap-2 border-t border-smoke pt-4 sm:grid-cols-2 xl:grid-cols-3">{product.product_variants.map((variant) => <li key={variant.id} className="text-xs text-silver-bright">{variant.name} · {variant.sku} · {variant.stock} in stock{variant.is_default ? " · Default" : ""}{variant.is_active ? " · Active" : " · Inactive"}</li>)}</ul> : null}
    </article>)}</div>
  </div>;
}
