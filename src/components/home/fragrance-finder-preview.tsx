"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { Reveal } from "@/components/home/reveal";
import { formatMoney } from "@/lib/format-money";
import type { FragranceFamily, ProductOccasion } from "@/types/product";
import type { Product } from "@/types/product";

const occasions: Array<{ value: ProductOccasion; label: string }> = [
  { value: "daily", label: "Everyday" },
  { value: "office", label: "Office" },
  { value: "business", label: "Business" },
  { value: "date-night", label: "Date night" },
  { value: "special-event", label: "Special event" },
  { value: "party", label: "Evening" },
];
const families: Array<{ value: FragranceFamily; label: string }> = [
  { value: "woody", label: "Woody" },
  { value: "fresh", label: "Fresh" },
  { value: "spicy", label: "Spicy" },
  { value: "sweet", label: "Sweet" },
  { value: "oriental", label: "Oriental" },
  { value: "citrus", label: "Citrus" },
  { value: "smoky", label: "Smoky" },
];

export function FragranceFinderPreview({ products }: { products: Product[] }) {
  const [occasion, setOccasion] = useState<ProductOccasion | "">("");
  const [family, setFamily] = useState<FragranceFamily | "">("");
  const [hasSearched, setHasSearched] = useState(false);
  const matches = hasSearched ? products
    .map((product) => ({ product, score: Number(Boolean(occasion && product.fragrance?.occasions.includes(occasion))) + Number(Boolean(family && product.fragrance?.family === family)) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score) : [];

  return (
    <section className="page-gutter bg-graphite py-14 sm:py-20 lg:py-28">
      <Reveal className="site-container border border-gold-muted bg-ink px-6 py-10 sm:px-10 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-12 lg:px-16 lg:py-16">
        <div>
          <p className="type-eyebrow text-gold">Private consultation</p>
          <h2 className="type-heading mt-5 max-w-2xl text-ivory">Find your signature scent.</h2>
          <p className="type-body-muted mt-5 max-w-xl">Choose an occasion or a fragrance family for a considered place to start.</p>
          <Link href="/fragrances" className="mt-8 inline-flex items-center gap-2 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-silver-bright transition-colors hover:text-gold">Explore all fragrances <ArrowRight aria-hidden="true" size={16} /></Link>
        </div>
        <div className="mt-8 space-y-4 lg:mt-0">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs uppercase tracking-wider text-muted">Occasion
              <select value={occasion} onChange={(event) => setOccasion(event.target.value as ProductOccasion | "")} className="mt-2 min-h-12 w-full border border-smoke bg-charcoal px-3 text-sm text-ivory">
                <option value="">Any occasion</option>
                {occasions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="block text-xs uppercase tracking-wider text-muted">Fragrance family
              <select value={family} onChange={(event) => setFamily(event.target.value as FragranceFamily | "")} className="mt-2 min-h-12 w-full border border-smoke bg-charcoal px-3 text-sm text-ivory">
                <option value="">Any family</option>
                {families.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>
          <button type="button" disabled={!occasion && !family} onClick={() => setHasSearched(true)} className="inline-flex min-h-11 items-center gap-2 border border-gold-muted px-5 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-gold transition-colors hover:bg-gold hover:text-ink disabled:cursor-not-allowed disabled:opacity-45">
            <Compass aria-hidden="true" size={16} /> Find a match
          </button>
          {hasSearched ? <div aria-live="polite" className="border-t border-smoke pt-4">
            {matches.length ? <>
              <p className="type-eyebrow text-gold">A place to start</p>
              <ul className="mt-3 space-y-2">
                {matches.map(({ product }) => <li key={product.id}>
                  <Link href={`/products/${product.slug}`} className="flex items-center justify-between gap-4 text-sm text-ivory hover:text-gold">
                    <span>{product.brand} · {product.name}</span><span className="shrink-0 text-silver">{product.variants[0] ? formatMoney(product.variants[0].price) : ""}</span>
                  </Link>
                </li>)}
              </ul>
            </> : <p className="text-sm text-silver">No fragrances match those preferences yet. Try a different family or occasion.</p>}
          </div> : null}
        </div>
      </Reveal>
    </section>
  );
}
