"use client";

import { CampaignImage } from "@/components/home/campaign-image";
import { Button } from "@/components/ui/button";
import { useCart } from "@/features/cart/use-cart";
import { useWishlist } from "@/features/wishlist/use-wishlist";
import type { Product } from "@/types/product";
import { formatMoney } from "@/lib/format-money";

export function ProductDetails({ product }: { product: Product }) {
  const firstVariant = product.variants[0];
  const { addItem } = useCart();
  const { toggleItem, isSaved } = useWishlist();

  return (
    <section className="section-space page-gutter bg-ink">
      <div className="site-container grid gap-10 py-12 md:grid-cols-2">
        <div className="space-y-4">
          <CampaignImage
            src={product.images[0]?.url ?? "/images/campaign/hero-placeholder.svg"}
            alt={product.images[0]?.alt ?? product.name}
            className="aspect-[4/5]"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
        </div>

        <article className="flex flex-col justify-center text-ivory">
          <p className="type-eyebrow text-gold">{product.brand}</p>
          <h1 className="type-heading mt-5 text-ivory">{product.name}</h1>
          <p className="mt-5 text-sm uppercase tracking-[0.14em] text-muted">{product.category}</p>
          <p className="mt-6 max-w-2xl text-sm leading-7 text-silver-bright">{product.description}</p>

          <div className="mt-7 flex items-center gap-4">
            <span className="type-heading text-gold">
              {firstVariant ? formatMoney(firstVariant.price) : "—"}
            </span>
            <span className="text-xs uppercase tracking-[0.18em] text-muted">{firstVariant?.size ?? "Signature size"}</span>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="primary" onClick={() => addItem(product.slug)}>
              Add to cart
            </Button>
            <Button variant="luxury-outline" aria-pressed={isSaved(product.slug)} onClick={() => toggleItem(product.slug)}>
              {isSaved(product.slug) ? "Remove wishlist" : "Add to wishlist"}
            </Button>
          </div>

          {product.fragrance && (
            <div className="mt-10 border-t border-graphite pt-8">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-gold">Family</p>
                  <p className="mt-2 text-sm uppercase text-silver-bright">{product.fragrance.family}</p>
                </div>
                <div>
                  <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-gold">Longevity</p>
                  <p className="mt-2 text-sm text-silver-bright">{product.fragrance.longevity}h</p>
                </div>
              </div>
              <div className="mt-5">
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-gold">Notes</p>
                <p className="mt-2 text-sm text-silver-bright">{product.fragrance.topNotes.join(", ")}</p>
              </div>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
