"use client";

import { useState } from "react";
import { CampaignImage } from "@/components/home/campaign-image";
import { Button } from "@/components/ui/button";
import { useCart } from "@/features/cart/use-cart";
import { useWishlist } from "@/features/wishlist/use-wishlist";
import type { Product } from "@/types/product";
import { formatMoney } from "@/lib/format-money";
import { CatalogDataNotice } from "@/components/product/catalog-data-notice";
import { isVariantAvailable } from "@/features/cart/cart-utils";
import { imageForVariant } from "@/features/products/variant-image";

export function ProductDetails({ product, isDemo = false }: { product: Product; isDemo?: boolean }) {
  const [selectedVariantId, setSelectedVariantId] = useState(product.variants[0]?.id ?? "");
  const selectedVariant = product.variants.find((variant) => variant.id === selectedVariantId) ?? product.variants[0];
  const selectedImage = imageForVariant(product.images, selectedVariant);
  const { addItem } = useCart();
  const { toggleItem, isSaved } = useWishlist();

  return (
    <section className="section-space page-gutter bg-ink">
      <div className="site-container grid gap-10 py-12 md:grid-cols-2">
        <div className="space-y-4">
          <CampaignImage
            src={selectedImage?.url ?? "/images/campaign/hero-placeholder.svg"}
            alt={selectedImage?.alt ?? product.name}
            className="aspect-[4/5]"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
        </div>

        <article className="flex flex-col justify-center text-ivory">
          <p className="type-eyebrow text-gold">{product.brand}</p>
          <h1 className="type-heading mt-5 text-ivory">{product.name}</h1>
          <p className="mt-5 text-sm uppercase tracking-[0.14em] text-muted">{product.category}</p>
          <CatalogDataNotice isDemo={isDemo} />
          <p className="mt-6 max-w-2xl text-sm leading-7 text-silver-bright">{product.description}</p>

          {product.category === "fragrance" && product.variants.length > 0 ? (
            <fieldset className="mt-7">
              <legend className="text-xs font-bold uppercase tracking-[0.16em] text-silver-bright">Bottle size</legend>
              <div className="mt-3 grid max-w-md grid-cols-2 gap-3">
                {product.variants.map((variant) => {
                  const isSelected = variant.id === selectedVariant?.id;
                  const unavailable = !isVariantAvailable(variant);
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      aria-pressed={isSelected}
                      disabled={unavailable}
                      onClick={() => setSelectedVariantId(variant.id)}
                      className={`min-h-20 border px-4 py-3 text-left transition-colors ${isSelected ? "border-gold bg-gold/10" : "border-smoke bg-charcoal hover:border-gold-muted"} disabled:cursor-not-allowed disabled:opacity-45`}
                    >
                      <span className="block text-sm font-semibold text-ivory">{variant.size ?? variant.name}</span>
                      <span className="mt-2 block text-sm text-gold">{formatMoney(variant.price)}</span>
                      {unavailable ? <span className="mt-1 block text-[0.65rem] uppercase tracking-wider text-muted">Unavailable</span> : null}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          <div className="mt-7 flex items-center gap-4">
            <span className="type-heading text-gold">
              {selectedVariant ? formatMoney(selectedVariant.price) : "—"}
            </span>
            <span className="text-xs uppercase tracking-[0.18em] text-muted">{selectedVariant?.size ?? selectedVariant?.name ?? "Signature size"}</span>
          </div>
          {selectedVariant ? <p className="mt-2 text-xs uppercase tracking-wider text-muted">SKU {selectedVariant.sku}</p> : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="primary" disabled={!selectedVariant || !isVariantAvailable(selectedVariant)} onClick={() => selectedVariant && addItem(product.slug, selectedVariant)}>
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
