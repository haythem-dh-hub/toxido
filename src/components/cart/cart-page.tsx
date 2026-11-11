"use client";

import { useCart } from "@/features/cart/use-cart";
import { CampaignImage } from "@/components/home/campaign-image";
import { Button } from "@/components/ui/button";
import { catalogProducts } from "@/features/products/mock-products";
import { formatMoney } from "@/lib/format-money";
import Link from "next/link";

export function CartPage() {
  const { items, removeItem, updateQuantity } = useCart();
  const lines = items.flatMap((item) => {
    const product = catalogProducts.find((entry) => entry.slug === item.productSlug);
    const variant = product?.variants[0];
    return product && variant ? [{ item, product, variant }] : [];
  });
  const subtotal = lines.reduce((sum, line) => sum + line.variant.price.amount * line.item.quantity, 0);

  return (
    <section className="section-space page-gutter bg-ink">
      <div className="site-container">
        <div className="mb-10">
          <p className="type-eyebrow text-gold">Private cart</p>
          <h1 className="type-heading mt-4 text-ivory">Your ritual objects</h1>
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
                return (
                  <article key={item.productSlug} className="flex flex-wrap items-center gap-5 border border-smoke bg-charcoal p-5">
                    <div className="w-24">
                      <CampaignImage src={product.images[0]?.url ?? "/images/campaign/hero-placeholder.svg"} alt={product.images[0]?.alt ?? product.name} className="aspect-square" sizes="96px" />
                    </div>
                    <div className="flex-1">
                      <p className="type-eyebrow text-gold">{product.brand}</p>
                      <h3 className="type-title mt-2 text-ivory">{product.name}</h3>
                      <p className="mt-2 text-sm text-muted">{variant.name} · {formatMoney(variant.price)}</p>
                    </div>
                    <label className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted">
                      Qty
                      <input aria-label={`Quantity for ${product.name}`} type="number" min="1" max={variant.stock} value={item.quantity} onChange={(event) => updateQuantity(item.productSlug, Math.min(Number(event.target.value), variant.stock))} className="w-16 border border-smoke bg-ink px-2 py-2 text-center text-ivory" />
                    </label>
                    <p className="w-28 text-right text-sm text-ivory">{formatMoney({ ...variant.price, amount: variant.price.amount * item.quantity })}</p>
                    <Button variant="ghost" onClick={() => removeItem(item.productSlug)} className="border border-gold-muted text-gold hover:bg-gold hover:text-ink">
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
                <span>Subtotal</span>
                <span className="text-ivory">{formatMoney({ amount: subtotal, currency: "NGN" })}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-silver-bright">
                <span>Delivery</span>
                <span className="text-ivory">Not configured yet</span>
              </div>
              <div className="mt-6 border-t border-gold-muted/50 pt-6">
                {lines.length ? <Link href="/checkout" className="inline-flex min-h-11 w-full items-center justify-center border border-silver-bright bg-ivory px-5 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-ink transition-colors hover:bg-silver-bright">Continue to checkout</Link> : <Button disabled className="w-full">Continue to checkout</Button>}
                <p className="mt-4 text-xs leading-5 text-muted">Checkout is not connected yet. You can review details, but no order can be placed.</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
