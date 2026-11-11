import { CatalogPage } from "@/components/product/catalog-page";
import { catalogProducts } from "@/features/products/mock-products";

export default function BestSellersPage() {
  return <CatalogPage title="Best sellers" eyebrow="Most desired" products={catalogProducts.filter((product) => product.bestSeller)} />;
}
