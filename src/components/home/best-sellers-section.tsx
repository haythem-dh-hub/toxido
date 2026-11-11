'use client';

import Link from "next/link";
import { CampaignImage } from "@/components/home/campaign-image";
import { Reveal } from "@/components/home/reveal";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { useCart } from "@/features/cart/use-cart";
import { fragranceProducts } from "@/features/products/mock-products";
import { formatMoney } from "@/lib/format-money";

export function BestSellersSection() {
  const { addItem } = useCart();
  const bestSellers = fragranceProducts.filter((product) => product.bestSeller);

  return (
    <section className="section-space page-gutter border-y border-smoke bg-charcoal">
      <div className="site-container">
        <SectionHeading eyebrow="Most desired" title="The signatures." description="Fragrances that remain long after the room has changed." />
        <div className="mt-12 grid gap-x-4 gap-y-7 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          {bestSellers.map((product, index) => {
            const variant = product.variants[0];
            return (
              <Reveal key={product.id} delay={index * 0.05}>
                <article className="overflow-hidden border border-gold-muted/45 bg-charcoal">
                  <Link href={`/products/${product.slug}`} className="group block">
                    <CampaignImage src={product.images[0]?.url ?? "/images/campaign/hero-placeholder.svg"} alt={product.images[0]?.alt ?? product.name} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="aspect-square" />
                    <div className="p-5">
                      <p className="type-eyebrow text-gold">{product.brand}</p>
                      <h3 className="type-title mt-2 text-ivory">{product.name}</h3>
                      <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted">{variant?.name}</p>
                      <p className="mt-4 text-sm font-semibold text-silver-bright">{variant ? formatMoney(variant.price) : "—"}</p>
                    </div>
                  </Link>
                  <div className="px-5 pb-5">
                    <Button variant="luxury-outline" className="w-full" disabled={!variant || variant.stock < 1} onClick={() => addItem(product.slug)}>Add to cart</Button>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
