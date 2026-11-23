"use client";

import { useCart } from "@/features/cart/use-cart";
import { CampaignImage } from "@/components/home/campaign-image";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format-money";
import { CatalogDataNotice } from "@/components/product/catalog-data-notice";
import Link from "next/link";
import { cartItemKey, isVariantAvailable, resolveCartLines } from "@/features/cart/cart-utils";

export function CartPage() {
  const { items, removeItem, updateQuantity, products, catalogIsDemo } = useCart();
  const lines = resolveCartLines(items, products);
  const subtotals = lines.reduce<Record<string, number>>((totals, line) => {
    if (!line.variant) return totals;
    const currency = line.variant.price.currency;
    totals[currency] = (totals[currency] ?? 0) + line.variant.price.amount * line.item.quantity;
    return totals;
  }, {});
  const canCheckout = lines.length > 0 && lines.every(({ item, product, variant }) => product && variant && isVariantAvailable(variant, item.quantity));

  return (
    <section className="section-space page-gutter bg-ink">
      <div className="site-container">
        <div className="mb-10">
          <p className="type-eyebrow text-gold">Private cart</p>
          <h1 className="type-heading mt-4 text-ivory">Your ritual objects</h1>
          {lines.length && catalogIsDemo ? <CatalogDataNotice isDemo={catalogIsDemo} /> : null}
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {lines.length === 0 ? (
              <div className="border border-gold-muted/50 bg-charcoal p-10 text-center">
                <p className="type-title text-ivory">The cart is empty</p>
                <p className="mt-4 text-sm text-muted">Select an object from the collection to begin your edit.</p>
                <Link href="/fragrances" className="mt-6 inline-flex min-h-11 items-center border border-gold-muted px-5 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-gold">Explore fragrances</Link>
              </div>
            ) : (
              lines.map(({ item, product, variant }) => {
                const label = product?.name ?? item.productSlug;
                return (
                  <article key={cartItemKey(item)} className="flex flex-wrap items-center gap-5 border border-smoke bg-charcoal p-5">
                    {product ? <div className="w-24">
                      <CampaignImage src={product.images[0]?.url ?? "/images/campaign/hero-placeholder.svg"} alt={product.images[0]?.alt ?? product.name} className="aspect-square" sizes="96px" />
                    </div> : null}
                    <div className="flex-1">
                      {product ? <p className="type-eyebrow text-gold">{product.brand}</p> : null}
                      <h3 className="type-title mt-2 text-ivory">{label}</h3>
                      <p className="mt-2 text-sm text-muted">{(variant?.size ?? variant?.name ?? item.variantName) || "Variant unavailable"}{variant ? ` · ${formatMoney(variant.price)}` : ""}</p>
                      {variant ? <p className="mt-1 text-xs uppercase tracking-wider text-muted">SKU {variant.sku}</p> : item.variantSku ? <p className="mt-1 text-xs uppercase tracking-wider text-muted">SKU {item.variantSku}</p> : null}
                      {!variant || variant.stock < 1 ? <p className="mt-2 text-xs uppercase tracking-wider text-red-300">Selected size unavailable</p> : null}
                    </div>
                    {variant && variant.stock > 0 ? <label className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted">
                      Qty
                      <input aria-label={`Quantity for ${label} ${variant.size ?? variant.name}`} type="number" min="1" max={variant.stock} value={item.quantity} onChange={(event) => updateQuantity(item.productSlug, variant, Math.min(Number(event.target.value), variant.stock))} className="w-16 border border-smoke bg-ink px-2 py-2 text-center text-ivory" />
                    </label> : null}
                    <p className="w-28 text-right text-sm text-ivory">{variant ? formatMoney({ ...variant.price, amount: variant.price.amount * item.quantity }) : "—"}</p>
                    <Button variant="ghost" onClick={() => removeItem(item.productSlug, item.variantId)} className="border border-gold-muted text-gold hover:bg-gold hover:text-ink">
                      Remove
                    </Button>
                  </article>
                );
              })
            )}
          </div>

          <aside className="border border-gold-muted/50 bg-charcoal p-7">
            <p className="type-eyebrow text-gold">Order summary</p>
            <div className="mt-8 space-y-4 border-t border-smoke pt-5">
              <div className="flex items-center justify-between text-sm text-silver-bright">
                <span>Sample subtotal</span>
                <span className="text-right text-ivory">{Object.entries(subtotals).map(([currency, amount]) => <span key={currency} className="block">{formatMoney({ amount, currency: currency as "TND" | "USD" | "NGN" })}</span>)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-silver-bright">
                <span>Delivery</span>
                <span className="text-right text-muted">Confirmed with live order</span>
              </div>
              <div className="mt-6 border-t border-gold-muted/50 pt-6">
                {canCheckout ? <Link href="/checkout" className="inline-flex min-h-11 w-full items-center justify-center border border-silver-bright bg-ivory px-5 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-ink transition-colors hover:bg-silver-bright">Continue to checkout</Link> : <Button disabled className="w-full">Continue to checkout</Button>}
                {!canCheckout && items.length > 0 ? <p className="mt-3 text-xs text-muted">Remove unavailable sizes or reduce quantities to continue.</p> : null}
                <p className="mt-4 text-xs leading-5 text-muted">Sample totals are estimates. Final price and stock must be confirmed against live inventory.</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
