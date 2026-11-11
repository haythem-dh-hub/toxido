import { fragranceProducts } from "@/features/products/mock-products";
import { CatalogPage } from "@/components/product/catalog-page";

export default function FragrancesPage() {
  return <CatalogPage title="Fragrances" eyebrow="The TOXIDO collection" products={fragranceProducts} />;
}
