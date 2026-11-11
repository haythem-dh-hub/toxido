import { CatalogPage } from "@/components/product/catalog-page";
import { accessoryProducts } from "@/features/products/mock-products";

export default function AccessoriesPage() {
  return <CatalogPage title="Accessories" eyebrow="The considered essentials" products={accessoryProducts} />;
}
