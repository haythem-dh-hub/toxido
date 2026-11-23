import type { Cart, CartLine } from "@/types/commerce";
import type { Product } from "@/types/product";
import type { ApiResponse } from "@/types/api";

export async function createCartFromLines(lines: CartLine[]): Promise<ApiResponse<Cart>> {
  return {
    data: {
      id: "cart-demo",
      lines,
      subtotal: { amount: lines.reduce((sum, line) => sum + line.unitPrice.amount * line.quantity, 0), currency: lines[0]?.unitPrice.currency ?? "TND" },
      updatedAt: new Date().toISOString(),
    },
  };
}

export async function addProductToCart(product: Product, quantity = 1, selectedVariant = product.variants[0]): Promise<ApiResponse<CartLine>> {

  return {
    data: {
      id: `line-${product.id}-${selectedVariant?.id ?? "default"}`,
      productId: product.id,
      variantId: selectedVariant?.id ?? "default",
      name: product.name,
      variantName: selectedVariant?.size ?? selectedVariant?.name ?? "Signature",
      quantity,
      unitPrice: selectedVariant?.price ?? { amount: 0, currency: "TND" },
      image: product.images[0],
    },
  };
}
