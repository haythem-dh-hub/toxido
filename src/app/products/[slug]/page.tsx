import { notFound } from "next/navigation";
import { ProductDetails } from "@/components/product/product-details";
import { getProductBySlug } from "@/services/products-service";

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { product, isDemo } = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  return <ProductDetails product={product} isDemo={isDemo} />;
}
