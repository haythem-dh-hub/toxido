"use client";

import { ProductCardBase } from "@/components/ui/product-card-base";
import { CampaignImage } from "@/components/home/campaign-image";
import { Button } from "@/components/ui/button";
import { useWishlist } from "@/features/wishlist/use-wishlist";
import { catalogProducts } from "@/features/products/mock-products";
import Link from "next/link";
import { formatMoney } from "@/lib/format-money";

export function WishlistPage() {
  const { items, toggleItem } = useWishlist();
  const savedProducts = catalogProducts.filter((product) => items.includes(product.slug));

  return (
    <section className="section-space page-gutter bg-ink">
      <div className="site-container">
        <div className="mb-10">
          <p className="type-eyebrow text-gold">The private edit</p>
          <h1 className="type-heading mt-4 text-ivory">Wishlist</h1>
        </div>

        {savedProducts.length === 0 ? (
          <div className="border border-gold-muted/50 bg-charcoal p-10 text-center">
            <p className="type-title text-ivory">No objects selected</p>
            <p className="mt-4 text-sm text-muted">Your considered collection is waiting.</p>
            <Link href="/fragrances" className="mt-6 inline-flex min-h-11 items-center border border-gold-muted px-5 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-gold">Explore fragrances</Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {savedProducts.map((product) => (
              <ProductCardBase
                key={product.id}
                href={`/products/${product.slug}`}
                brand={product.brand}
                name={product.name}
                meta={product.category}
                price={product.variants[0] ? formatMoney(product.variants[0].price) : "—"}
                image={<CampaignImage src={product.images[0]?.url ?? "/images/campaign/hero-placeholder.svg"} alt={product.images[0]?.alt ?? product.name} sizes="(max-width: 640px) 100vw, 50vw" />}
                action={<Button variant="ghost" onClick={() => toggleItem(product.slug)} className="min-h-9 px-2 border border-gold-muted text-gold hover:bg-gold hover:text-ink">Remove</Button>}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
