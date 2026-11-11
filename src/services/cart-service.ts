import type { Cart, CartLine } from "@/types/commerce";
import type { Product } from "@/types/product";
import type { ApiResponse } from "@/types/api";

export async function createCartFromLines(lines: CartLine[]): Promise<ApiResponse<Cart>> {
  return {
    data: {
      id: "cart-demo",
      lines,
      subtotal: { amount: lines.reduce((sum, line) => sum + line.unitPrice.amount * line.quantity, 0), currency: "NGN" },
      updatedAt: new Date().toISOString(),
    },
  };
}

export async function addProductToCart(product: Product, quantity = 1): Promise<ApiResponse<CartLine>> {
  const firstVariant = product.variants[0];

  return {
    data: {
      id: `line-${product.id}`,
      productId: product.id,
      variantId: firstVariant?.id ?? "default",
      name: product.name,
      variantName: firstVariant?.name ?? "Signature",
      quantity,
      unitPrice: firstVariant?.price ?? { amount: 0, currency: "NGN" },
      image: product.images[0],
    },
  };
}
