import type { Product } from "@/types/product";
import type { ApiResponse } from "@/types/api";
import { catalogProducts } from "@/features/products/mock-products";

export async function getProducts(): Promise<ApiResponse<Product[]>> {
  return { data: catalogProducts };
}

export async function getProductBySlug(slug: string): Promise<ApiResponse<Product | null>> {
  const product = catalogProducts.find((item) => item.slug === slug);
  return { data: product ?? null };
}
