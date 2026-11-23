import { AccessoriesShowcase } from "@/components/home/accessories-showcase";
import { BestSellersSection } from "@/components/home/best-sellers-section";
import { BrandPhilosophy } from "@/components/home/brand-philosophy";
import { FeaturedCollections } from "@/components/home/featured-collections";
import { FragranceFinderPreview } from "@/components/home/fragrance-finder-preview";
import { HomeHero } from "@/components/home/home-hero";
import { NewsletterSection } from "@/components/home/newsletter-section";
import { WhyToxido } from "@/components/home/why-toxido";
import { FragrancesSignatures } from "@/components/home/fragrances-signatures";
import { getCatalogProducts } from "@/services/products-service";
import { CatalogDataNotice } from "@/components/product/catalog-data-notice";

export default async function HomePage() {
  const catalog = await getCatalogProducts();
  const fragrances = catalog.products.filter((product) => product.category === "fragrance");
  return (
    <>
      <HomeHero />
      {catalog.isDemo ? <div className="page-gutter bg-ink"><div className="site-container"><CatalogDataNotice isDemo /></div></div> : null}
      {fragrances.length ? <FragrancesSignatures products={fragrances} /> : null}
      {catalog.products.length ? <FeaturedCollections /> : null}
      {fragrances.some((product) => product.bestSeller) ? <BestSellersSection products={fragrances} /> : null}
      <BrandPhilosophy />
      {fragrances.length ? <FragranceFinderPreview products={fragrances} /> : null}
      {catalog.products.some((product) => product.category === "accessory") ? <AccessoriesShowcase /> : null}
      <WhyToxido />
      <NewsletterSection />
    </>
  );
}
