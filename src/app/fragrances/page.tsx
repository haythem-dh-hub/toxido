import { CatalogPage } from "@/components/product/catalog-page";
import { getCatalogProducts } from "@/services/products-service";

export default async function FragrancesPage() {
  const catalog = await getCatalogProducts();
  return <CatalogPage title="Fragrances" eyebrow="The TOXIDO collection" products={catalog.products.filter((product) => product.category === "fragrance")} isDemo={catalog.isDemo} />;
}
