
import { ProductGrid } from "@/components/product/product-grid";
import type { Product } from "@/types/product";

export function FragrancesSignatures({ products }: { products: Product[] }) {
  return (
              
              
              <section className="section-space page-gutter bg-ink">
                <div className="site-container">
                  <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
                    <div className="max-w-3xl">
                      <p className="type-eyebrow text-gold">The TOXIDO edit</p>
                      <h2 className="type-heading mt-4 text-ivory">Fragrance signatures</h2>
                    </div>
                    <a className="inline-flex min-h-11 items-center justify-center border border-gold-muted px-5 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-gold transition-colors duration-300 hover:border-gold hover:bg-gold hover:text-ink" href="/fragrances">
                      View all
                    </a>
                  </div>
                  <ProductGrid products={products} />
                </div>
              </section>
        
        
  );
}
