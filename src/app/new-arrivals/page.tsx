import { CatalogPage } from "@/components/product/catalog-page";
import { catalogProducts } from "@/features/products/mock-products";

export default function NewArrivalsPage() {
  return <CatalogPage title="New arrivals" eyebrow="Just landed" products={catalogProducts.filter((product) => product.newArrival)} />;
}
