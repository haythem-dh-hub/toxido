import { ProductGrid } from "@/components/product/product-grid";
import { CatalogDataNotice } from "@/components/product/catalog-data-notice";
import { getCatalogProducts } from "@/services/products-service";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const catalog = await getCatalogProducts();
  const query = q.trim();
  const matches = query
    ? catalog.products.filter((product) => [
      product.name,
      product.brand,
      ...product.tags,
      product.fragrance?.family,
      ...(product.fragrance?.topNotes ?? []),
      ...(product.fragrance?.middleNotes ?? []),
      ...(product.fragrance?.baseNotes ?? []),
    ].filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase()))
    : [];

  return (
    <section className="section-space page-gutter bg-ink">
      <div className="site-container">
        <div className="mb-10">
          <p className="type-eyebrow text-gold">Find your signature</p>
          <h1 className="type-heading mt-5 max-w-3xl text-ivory">{query ? `Results for “${query}”` : "Search the collection"}</h1>
          <CatalogDataNotice isDemo={catalog.isDemo} />
        </div>
        <form action="/search" className="mb-10 flex max-w-2xl gap-3">
        <label htmlFor="product-search" className="sr-only">Search products</label>
          <input id="product-search" name="q" defaultValue={query} placeholder="Name, brand, or note" className="min-h-12 min-w-0 flex-1 border border-smoke bg-charcoal px-4 text-sm text-ivory placeholder:text-muted" />
          <button className="min-h-12 border border-gold-muted px-5 text-xs font-bold uppercase tracking-wider text-gold">Search</button>
        </form>
        {matches.length ? <ProductGrid products={matches} /> : (
          <div className="border border-gold-muted/50 bg-charcoal p-10 text-center">
            <p className="type-title text-ivory">{query ? "No matching fragrances found" : "Search by name, brand, or fragrance note"}</p>
            {query ? <p className="mt-3 text-sm text-muted">Try another search or explore the full collection.</p> : null}
            <a href="/fragrances" className="mt-6 inline-flex min-h-11 items-center border border-gold-muted px-5 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-gold">Explore fragrances</a>
          </div>
        )}
      </div>
    </section>
  );
}
