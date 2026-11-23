import { useCommerce } from "@/features/cart/commerce-provider";
export type { CartItem } from "@/features/cart/commerce-provider";

export function useCart() {
  const { cart, addItem, updateQuantity, removeItem, products, catalogIsDemo } = useCommerce();
  return { items: cart, addItem, updateQuantity, removeItem, products, catalogIsDemo };
}
