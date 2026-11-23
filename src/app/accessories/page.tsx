import { CatalogPage } from "@/components/product/catalog-page";
import { getCatalogProducts } from "@/services/products-service";

export default async function AccessoriesPage() {
  const catalog = await getCatalogProducts();
  return <CatalogPage title="Accessories" eyebrow="The considered essentials" products={catalog.products.filter((product) => product.category === "accessory")} isDemo={catalog.isDemo} />;
}
