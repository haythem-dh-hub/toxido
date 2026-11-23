import type { Product, ProductVariant } from "../../types/product";

export type CartItem = {
  productSlug: string;
  variantId: string;
  variantSku: string;
  variantName: string;
  quantity: number;
};

export type CartLine = { item: CartItem; product?: Product; variant?: ProductVariant };

export function normalizeCartItems(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): CartItem[] => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Partial<CartItem>;
    if (typeof item.productSlug !== "string" || !Number.isInteger(item.quantity) || (item.quantity ?? 0) < 1) return [];
    return [{
      productSlug: item.productSlug,
      variantId: typeof item.variantId === "string" ? item.variantId : "",
      variantSku: typeof item.variantSku === "string" ? item.variantSku : "",
      variantName: typeof item.variantName === "string" ? item.variantName : "",
      quantity: item.quantity as number,
    }];
  });
}

export function resolveCartVariant(item: CartItem, product: Product): ProductVariant | undefined {
  return item.variantId
    ? product.variants.find((variant) => variant.id === item.variantId)
    : product.variants[0];
}

export function cartItemKey(item: Pick<CartItem, "productSlug" | "variantId">): string {
  return `${item.productSlug}:${item.variantId || "default"}`;
}

function matchesVariant(item: CartItem, productSlug: string, variantId: string, defaultVariantId: string | undefined) {
  return item.productSlug === productSlug && (item.variantId === variantId || (!item.variantId && variantId === defaultVariantId));
}

export function addVariantToCart(
  cart: CartItem[],
  productSlug: string,
  variant: ProductVariant,
  defaultVariantId?: string,
): CartItem[] {
  const index = cart.findIndex((item) => matchesVariant(item, productSlug, variant.id, defaultVariantId));
  const nextItem = {
    productSlug,
    variantId: variant.id,
    variantSku: variant.sku,
    variantName: variant.size ?? variant.name,
  };
  if (index < 0) return [...cart, { ...nextItem, quantity: 1 }];
  return cart.map((item, i) => i === index ? { ...item, ...nextItem, quantity: item.quantity + 1 } : item);
}

export function setVariantCartQuantity(
  cart: CartItem[],
  productSlug: string,
  variant: ProductVariant,
  quantity: number,
  defaultVariantId?: string,
): CartItem[] {
  if (quantity < 1) return removeVariantFromCart(cart, productSlug, variant.id, defaultVariantId);
  return cart.map((item) => matchesVariant(item, productSlug, variant.id, defaultVariantId)
    ? { ...item, variantId: variant.id, variantSku: variant.sku, variantName: variant.size ?? variant.name, quantity }
    : item);
}

export function removeVariantFromCart(
  cart: CartItem[],
  productSlug: string,
  variantId: string,
  defaultVariantId?: string,
): CartItem[] {
  return cart.filter((item) => !matchesVariant(item, productSlug, variantId, defaultVariantId));
}

export function resolveCartLines(cart: CartItem[], products: Product[]): CartLine[] {
  return cart.map((item) => {
    const product = products.find((candidate) => candidate.slug === item.productSlug);
    return { item, product, variant: product ? resolveCartVariant(item, product) : undefined };
  });
}

export function calculateCartSubtotal(lines: CartLine[]): number {
  return lines.reduce((total, line) => total + (line.variant?.price.amount ?? 0) * line.item.quantity, 0);
}

export function isVariantAvailable(variant: ProductVariant, quantity = 1): boolean {
  return Number.isInteger(quantity) && quantity > 0 && variant.stock >= quantity;
}

export function buildCheckoutItems(lines: CartLine[]): { slug: string; variantId: string; quantity: number }[] | null {
  if (lines.some((line) => !line.product || !line.variant || !isVariantAvailable(line.variant, line.item.quantity))) return null;
  return lines.map(({ item, variant }) => ({ slug: item.productSlug, variantId: variant!.id, quantity: item.quantity }));
}
