"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import type { Product, ProductVariant } from "@/types/product";
import { addVariantToCart, normalizeCartItems, removeVariantFromCart, setVariantCartQuantity, type CartItem } from "@/features/cart/cart-utils";

export type { CartItem } from "@/features/cart/cart-utils";
type Snapshot = { cart: CartItem[]; wishlist: string[] };
type CommerceState = Snapshot & {
  products: Product[];
  catalogIsDemo: boolean;
  addItem: (slug: string, variant: ProductVariant) => void;
  updateQuantity: (slug: string, variant: ProductVariant, quantity: number) => void;
  removeItem: (slug: string, variantId: string) => void;
  toggleWishlist: (slug: string) => void;
};

const emptySnapshot: Snapshot = { cart: [], wishlist: [] };
const listeners = new Set<() => void>();
const readStorage = (): Snapshot => {
  if (typeof window === "undefined") return emptySnapshot;
  try {
    const cart = normalizeCartItems(JSON.parse(localStorage.getItem("toxido-cart") ?? "[]"));
    const wishlist = JSON.parse(localStorage.getItem("toxido-wishlist") ?? "[]") as string[];
    return {
      cart,
      wishlist: Array.isArray(wishlist) ? wishlist.filter((slug): slug is string => typeof slug === "string") : [],
    };
  } catch {
    return emptySnapshot;
  }
};

let snapshot = readStorage();
const getSnapshot = () => snapshot;
const getServerSnapshot = () => emptySnapshot;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const update = (next: Snapshot) => {
  snapshot = next;
  try {
    localStorage.setItem("toxido-cart", JSON.stringify(next.cart));
    localStorage.setItem("toxido-wishlist", JSON.stringify(next.wishlist));
  } catch {
    // Commerce remains usable for this session when browser storage is unavailable.
  }
  listeners.forEach((listener) => listener());
};

const CommerceContext = createContext<CommerceState | null>(null);

export function CommerceProvider({ children, products, catalogIsDemo }: { children: ReactNode; products: Product[]; catalogIsDemo: boolean }) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const addItem = (slug: string, variant: ProductVariant) => {
    const defaultVariantId = products.find((product) => product.slug === slug)?.variants[0]?.id;
    update({ ...snapshot, cart: addVariantToCart(snapshot.cart, slug, variant, defaultVariantId) });
  };
  const updateQuantity = (slug: string, variant: ProductVariant, quantity: number) => {
    const defaultVariantId = products.find((product) => product.slug === slug)?.variants[0]?.id;
    update({ ...snapshot, cart: setVariantCartQuantity(snapshot.cart, slug, variant, quantity, defaultVariantId) });
  };
  const removeItem = (slug: string, variantId: string) => {
    const defaultVariantId = products.find((product) => product.slug === slug)?.variants[0]?.id;
    update({ ...snapshot, cart: removeVariantFromCart(snapshot.cart, slug, variantId, defaultVariantId) });
  };
  const toggleWishlist = (slug: string) => update({ ...snapshot, wishlist: snapshot.wishlist.includes(slug)
    ? snapshot.wishlist.filter((item) => item !== slug)
    : [...snapshot.wishlist, slug] });
  return <CommerceContext.Provider value={{ ...state, addItem, updateQuantity, removeItem, toggleWishlist, products, catalogIsDemo }}>{children}</CommerceContext.Provider>;
}

export function useCommerce() {
  const state = useContext(CommerceContext);
  if (!state) throw new Error("Commerce hooks must be used inside CommerceProvider.");
  return state;
}
