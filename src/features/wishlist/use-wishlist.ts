import { useCommerce } from "@/features/cart/commerce-provider";

export function useWishlist() {
  const { wishlist: items, toggleWishlist: toggleItem } = useCommerce();
  const isSaved = (productSlug: string) => items.includes(productSlug);
  return { items, toggleItem, isSaved };
}
