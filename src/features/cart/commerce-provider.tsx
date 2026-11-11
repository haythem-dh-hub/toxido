"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

export type CartItem = { productSlug: string; quantity: number };
type Snapshot = { cart: CartItem[]; wishlist: string[] };
type CommerceState = Snapshot & {
  addItem: (slug: string) => void;
  updateQuantity: (slug: string, quantity: number) => void;
  removeItem: (slug: string) => void;
  toggleWishlist: (slug: string) => void;
};

const emptySnapshot: Snapshot = { cart: [], wishlist: [] };
const listeners = new Set<() => void>();
const readStorage = (): Snapshot => {
  if (typeof window === "undefined") return emptySnapshot;
  try {
    const cart = JSON.parse(localStorage.getItem("toxido-cart") ?? "[]") as CartItem[];
    const wishlist = JSON.parse(localStorage.getItem("toxido-wishlist") ?? "[]") as string[];
    return {
      cart: Array.isArray(cart) ? cart.filter((item) => typeof item.productSlug === "string" && Number.isInteger(item.quantity) && item.quantity > 0) : [],
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

const commerceActions = {
  addItem: (slug: string) => {
    const existing = snapshot.cart.find((item) => item.productSlug === slug);
    update({ ...snapshot, cart: existing
      ? snapshot.cart.map((item) => item.productSlug === slug ? { ...item, quantity: item.quantity + 1 } : item)
      : [...snapshot.cart, { productSlug: slug, quantity: 1 }] });
  },
  updateQuantity: (slug: string, quantity: number) => update({ ...snapshot, cart: quantity < 1
    ? snapshot.cart.filter((item) => item.productSlug !== slug)
    : snapshot.cart.map((item) => item.productSlug === slug ? { ...item, quantity } : item) }),
  removeItem: (slug: string) => update({ ...snapshot, cart: snapshot.cart.filter((item) => item.productSlug !== slug) }),
  toggleWishlist: (slug: string) => update({ ...snapshot, wishlist: snapshot.wishlist.includes(slug)
    ? snapshot.wishlist.filter((item) => item !== slug)
    : [...snapshot.wishlist, slug] }),
};

const CommerceContext = createContext<CommerceState | null>(null);

export function CommerceProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return <CommerceContext.Provider value={{ ...state, ...commerceActions }}>{children}</CommerceContext.Provider>;
}

export function useCommerce() {
  const state = useContext(CommerceContext);
  if (!state) throw new Error("Commerce hooks must be used inside CommerceProvider.");
  return state;
}
