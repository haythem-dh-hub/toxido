"use client";

import { useEffect } from "react";
import { useCart } from "@/features/cart/use-cart";

export function ClearCartOnPaidOrder() {
  const { items, removeItem } = useCart();
  useEffect(() => {
    for (const item of items) removeItem(item.productSlug, item.variantId);
  }, [items, removeItem]);
  return null;
}
