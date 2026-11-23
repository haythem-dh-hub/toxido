import { CatalogPage } from "@/components/product/catalog-page";
import { getCatalogProducts } from "@/services/products-service";

export default async function NewArrivalsPage() {
  const catalog = await getCatalogProducts();
  return <CatalogPage title="New arrivals" eyebrow="Just landed" products={catalog.products.filter((product) => product.newArrival)} isDemo={catalog.isDemo} />;
}
