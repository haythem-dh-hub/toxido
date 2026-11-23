import { CatalogPage } from "@/components/product/catalog-page";
import { getCatalogProducts } from "@/services/products-service";

export default async function BestSellersPage() {
  const catalog = await getCatalogProducts();
  return <CatalogPage title="Best sellers" eyebrow="Most desired" products={catalog.products.filter((product) => product.bestSeller)} isDemo={catalog.isDemo} />;
}
