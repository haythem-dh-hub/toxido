import { notFound } from "next/navigation";
import { ProductDetails } from "@/components/product/product-details";
import { catalogProducts } from "@/features/products/mock-products";

export function generateStaticParams() {
  return catalogProducts.map((product) => ({ slug: product.slug }));
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = catalogProducts.find((item) => item.slug === slug);

  if (!product) {
    notFound();
  }

  return <ProductDetails product={product} />;
}
