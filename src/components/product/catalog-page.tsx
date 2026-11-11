import Link from "next/link";
import { ProductGrid } from "@/components/product/product-grid";
import type { Product } from "@/types/product";

export function CatalogPage({ title, eyebrow, products, emptyMessage }: { title: string; eyebrow: string; products: Product[]; emptyMessage?: string }) {
  return (
    <section className="section-space page-gutter bg-ink">
      <div className="site-container">
        <div className="mb-10">
          <p className="type-eyebrow text-gold">{eyebrow}</p>
          <h1 className="type-heading mt-5 max-w-3xl text-ivory">{title}</h1>
        </div>
        {products.length ? <ProductGrid products={products} /> : (
          <div className="border border-gold-muted/50 bg-charcoal p-10 text-center">
            <p className="type-title text-ivory">{emptyMessage ?? "No products are available in this collection yet."}</p>
            <Link href="/fragrances" className="mt-6 inline-flex min-h-11 items-center border border-gold-muted px-5 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-gold">Explore fragrances</Link>
          </div>
        )}
      </div>
    </section>
  );
}
