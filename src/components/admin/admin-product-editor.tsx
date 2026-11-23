"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

type Variant = { id: string; name: string; sku: string; price_millimes: string | number; stock: number; is_default: boolean; is_active: boolean };
type Product = { id: string; slug: string; name: string; brand: string; description: string; category: "fragrance" | "accessory"; images: { id: string; alt: string; url: string; width: number; height: number }[]; tags: string[]; is_featured: boolean; best_seller: boolean; new_arrival: boolean; is_active: boolean; product_variants: Variant[] };

const blankProduct = { slug: "", name: "", brand: "TOXIDO", description: "", category: "fragrance" as const, tags: [] as string[], images: [] as Product["images"] };

export function AdminProductEditor({ initialProduct }: { initialProduct: Product | null }) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(initialProduct);
  const current = product ?? blankProduct;
  const [images, setImages] = useState<Product["images"]>(initialProduct?.images ?? []);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const endpoint = useMemo(() => product ? `/api/admin/products/${encodeURIComponent(product.id)}` : "/api/admin/products", [product]);

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = {
      ...(product ? {} : { slug: String(form.get("slug") ?? "").trim() }),
      name: String(form.get("name") ?? "").trim(),
      brand: String(form.get("brand") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
      category: String(form.get("category") ?? ""),
      tags: String(form.get("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
      images,
    };
    try {
      const response = await fetch(endpoint, { method: product ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { product?: { id: string }; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Product could not be saved.");
      if (!product && result.product?.id) { router.replace(`/admin/products/${result.product.id}`); router.refresh(); return; }
      setMessage("Product details saved.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Product could not be saved."); }
    finally { setSaving(false); }
  }

  async function refreshProduct() {
    if (!product) return;
    const response = await fetch(endpoint, { cache: "no-store" });
    const result = await response.json() as { product?: Product; error?: string };
    if (!response.ok || !result.product) throw new Error(result.error ?? "Product refresh failed.");
    setProduct(result.product);
    setImages(result.product.images);
  }

  function updateImage(index: number, field: keyof Product["images"][number], value: string) {
    setImages((currentImages) => currentImages.map((image, imageIndex) => imageIndex === index
      ? { ...image, [field]: field === "width" || field === "height" ? Number(value) : value }
      : image));
  }

  return <div>
    <Link href="/admin/products" className="text-xs uppercase tracking-wider text-gold hover:text-ivory">← Products</Link>
    <p className="type-eyebrow mt-6 text-gold">Catalog editor</p><h1 className="type-heading mt-2 text-ivory">{product ? product.name : "Add product"}</h1>
    <form onSubmit={saveProduct} className="mt-7 grid gap-5 border border-smoke bg-charcoal p-5 sm:grid-cols-2 sm:p-7">
      {!product ? <label className="text-xs uppercase tracking-wider text-silver-bright">Slug
        <input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={160} className="mt-2 min-h-11 w-full border border-smoke bg-ink px-3 text-sm normal-case tracking-normal text-ivory" />
      </label> : <div><p className="text-xs uppercase tracking-wider text-muted">Slug</p><p className="mt-3 text-sm text-silver-bright">{product.slug}</p></div>}
      <label className="text-xs uppercase tracking-wider text-silver-bright">Name
        <input name="name" required maxLength={160} defaultValue={current.name} className="mt-2 min-h-11 w-full border border-smoke bg-ink px-3 text-sm normal-case tracking-normal text-ivory" />
      </label>
      <label className="text-xs uppercase tracking-wider text-silver-bright">Brand
        <input name="brand" required maxLength={120} defaultValue={current.brand} className="mt-2 min-h-11 w-full border border-smoke bg-ink px-3 text-sm normal-case tracking-normal text-ivory" />
      </label>
      <label className="text-xs uppercase tracking-wider text-silver-bright">Category
        <select name="category" defaultValue={current.category} className="mt-2 min-h-11 w-full border border-smoke bg-ink px-3 text-sm text-ivory"><option value="fragrance">Fragrance</option><option value="accessory">Men’s accessories</option></select>
      </label>
      <label className="text-xs uppercase tracking-wider text-silver-bright">Tags <span className="normal-case text-muted">comma separated</span>
        <input name="tags" defaultValue={current.tags.join(", ")} className="mt-2 min-h-11 w-full border border-smoke bg-ink px-3 text-sm normal-case tracking-normal text-ivory" />
      </label>
      <label className="text-xs uppercase tracking-wider text-silver-bright sm:col-span-2">Description
        <textarea name="description" rows={4} maxLength={10000} defaultValue={current.description} className="mt-2 w-full border border-smoke bg-ink px-3 py-2 text-sm normal-case tracking-normal text-ivory" />
      </label>
      <fieldset className="sm:col-span-2"><legend className="text-xs uppercase tracking-wider text-silver-bright">Product images</legend>
        <p className="mt-1 text-[0.68rem] text-muted">Reference existing local `/images/...` files. Uploads and remote URLs are not supported.</p>
        <div className="mt-3 grid gap-3">{images.map((image, index) => <div key={`${image.id}-${index}`} className="grid gap-3 border border-smoke p-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_2fr_100px_100px_auto]">
          <label className="text-[0.62rem] uppercase tracking-wider text-muted">Image ID<input value={image.id} onChange={(event) => updateImage(index, "id", event.target.value)} maxLength={120} className="mt-1 min-h-10 w-full border border-smoke bg-ink px-2 text-xs normal-case tracking-normal text-ivory" /></label>
          <label className="text-[0.62rem] uppercase tracking-wider text-muted">Alt text<input value={image.alt} onChange={(event) => updateImage(index, "alt", event.target.value)} maxLength={240} className="mt-1 min-h-10 w-full border border-smoke bg-ink px-2 text-xs normal-case tracking-normal text-ivory" /></label>
          <label className="text-[0.62rem] uppercase tracking-wider text-muted">Local image path<input value={image.url} onChange={(event) => updateImage(index, "url", event.target.value)} placeholder="/images/products/item.png" className="mt-1 min-h-10 w-full border border-smoke bg-ink px-2 text-xs normal-case tracking-normal text-ivory" /></label>
          <label className="text-[0.62rem] uppercase tracking-wider text-muted">Width<input value={image.width} onChange={(event) => updateImage(index, "width", event.target.value)} type="number" min="1" step="1" className="mt-1 min-h-10 w-full border border-smoke bg-ink px-2 text-xs text-ivory" /></label>
          <label className="text-[0.62rem] uppercase tracking-wider text-muted">Height<input value={image.height} onChange={(event) => updateImage(index, "height", event.target.value)} type="number" min="1" step="1" className="mt-1 min-h-10 w-full border border-smoke bg-ink px-2 text-xs text-ivory" /></label>
          <button type="button" onClick={() => setImages((currentImages) => currentImages.filter((_, imageIndex) => imageIndex !== index))} className="min-h-10 self-end border border-smoke px-3 text-xs uppercase tracking-wider text-silver-bright hover:border-red-400/60 hover:text-red-200">Remove</button>
        </div>)}</div>
        <button type="button" onClick={() => setImages((currentImages) => [...currentImages, { id: "", alt: "", url: "", width: 0, height: 0 }])} className="mt-3 min-h-10 border border-gold-muted px-4 text-xs uppercase tracking-wider text-gold">Add image reference</button>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={saving} className="min-h-11 border border-gold px-5 text-xs font-bold uppercase tracking-wider text-gold hover:bg-gold/10 disabled:opacity-50">{saving ? "Saving…" : "Save product"}</button>
        {product ? <span className="text-xs text-muted">New products are created inactive.</span> : null}
      </div>
      {message ? <p role="status" className="text-sm text-emerald-300 sm:col-span-2">{message}</p> : null}
      {error ? <p role="alert" className="text-sm text-red-300 sm:col-span-2">{error}</p> : null}
    </form>
    {product ? <AdminVariants product={product} onRefresh={async () => { try { await refreshProduct(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Product refresh failed."); } }} /> : null}
  </div>;
}

function AdminVariants({ product, onRefresh }: { product: Product; onRefresh: () => Promise<void> }) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function createVariant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = { name: form.get("name"), sku: form.get("sku"), price_millimes: Number(form.get("price")), stock: Number(form.get("stock")), is_default: form.get("is_default") === "on" };
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}/variants`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Variant could not be added.");
      formElement.reset(); setMessage("Variant added inactive."); await onRefresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Variant could not be added."); }
    finally { setSaving(false); }
  }

  async function patchVariant(id: string, patch: Record<string, unknown>) {
    setError(""); setMessage("");
    const response = await fetch(`/api/admin/variants/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Variant could not be updated.");
    setMessage("Variant updated."); await onRefresh();
  }

  return <section className="mt-8">
    <p className="type-eyebrow text-gold">Variant and stock controls</p><h2 className="type-title mt-2 text-ivory">Variants</h2>
    <div className="mt-4 grid gap-4">{product.product_variants.map((variant) => <form key={variant.id} onSubmit={async (event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      try { await patchVariant(variant.id, { name: form.get("name"), sku: form.get("sku"), price_millimes: Number(form.get("price")), stock: Number(form.get("stock")), is_default: form.get("is_default") === "on" }); }
      catch (reason) { setError(reason instanceof Error ? reason.message : "Variant could not be updated."); }
    }} className="grid gap-3 border border-smoke bg-charcoal p-4 sm:grid-cols-2 xl:grid-cols-5">
      <label className="text-[0.65rem] uppercase tracking-wider text-muted">Size / name<input name="name" defaultValue={variant.name} required maxLength={120} className="mt-1 min-h-10 w-full border border-smoke bg-ink px-2 text-sm text-ivory" /></label>
      <label className="text-[0.65rem] uppercase tracking-wider text-muted">SKU<input name="sku" defaultValue={variant.sku} required maxLength={80} className="mt-1 min-h-10 w-full border border-smoke bg-ink px-2 text-sm text-ivory" /></label>
      <label className="text-[0.65rem] uppercase tracking-wider text-muted">Price (millimes)<input name="price" type="number" min="1" step="1" defaultValue={variant.price_millimes} required className="mt-1 min-h-10 w-full border border-smoke bg-ink px-2 text-sm text-ivory" /></label>
      <label className="text-[0.65rem] uppercase tracking-wider text-muted">Stock units<input name="stock" type="number" min="0" step="1" defaultValue={variant.stock} required className="mt-1 min-h-10 w-full border border-smoke bg-ink px-2 text-sm text-ivory" /></label>
      <div className="flex flex-wrap items-end gap-3"><label className="flex min-h-10 items-center gap-2 text-xs text-silver-bright"><input name="is_default" type="checkbox" defaultChecked={variant.is_default} /> Default</label><button type="submit" className="min-h-10 border border-gold-muted px-3 text-xs uppercase tracking-wider text-gold">Save</button><button type="button" onClick={() => void patchVariant(variant.id, { is_active: !variant.is_active }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Variant status could not be updated."))} className="min-h-10 border border-smoke px-3 text-xs uppercase tracking-wider text-silver-bright">{variant.is_active ? "Deactivate" : "Activate"}</button></div>
    </form>)}</div>
    <form onSubmit={createVariant} className="mt-5 grid gap-3 border border-gold-muted/40 bg-charcoal p-4 sm:grid-cols-2 xl:grid-cols-5">
      <h3 className="type-title text-ivory sm:col-span-2 xl:col-span-5">Add variant</h3>
      <label className="text-[0.65rem] uppercase tracking-wider text-muted">Size / name<input name="name" required maxLength={120} placeholder="50 ml" className="mt-1 min-h-10 w-full border border-smoke bg-ink px-2 text-sm text-ivory" /></label>
      <label className="text-[0.65rem] uppercase tracking-wider text-muted">SKU<input name="sku" required maxLength={80} className="mt-1 min-h-10 w-full border border-smoke bg-ink px-2 text-sm text-ivory" /></label>
      <label className="text-[0.65rem] uppercase tracking-wider text-muted">Price (millimes)<input name="price" type="number" min="1" step="1" required className="mt-1 min-h-10 w-full border border-smoke bg-ink px-2 text-sm text-ivory" /></label>
      <label className="text-[0.65rem] uppercase tracking-wider text-muted">Stock units<input name="stock" type="number" min="0" step="1" required className="mt-1 min-h-10 w-full border border-smoke bg-ink px-2 text-sm text-ivory" /></label>
      <div className="flex items-end gap-3"><label className="flex min-h-10 items-center gap-2 text-xs text-silver-bright"><input name="is_default" type="checkbox" /> Default</label><button type="submit" disabled={saving} className="min-h-10 border border-gold px-4 text-xs font-bold uppercase tracking-wider text-gold">Add inactive</button></div>
    </form>
    {message ? <p role="status" className="mt-3 text-sm text-emerald-300">{message}</p> : null}
    {error ? <p role="alert" className="mt-3 text-sm text-red-300">{error}</p> : null}
  </section>;
}
