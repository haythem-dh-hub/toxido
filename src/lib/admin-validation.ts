import "server-only";

import { existsSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { isSafeProductSlug, isValidMillimePrice, isValidStock } from "@/features/admin/admin-security";

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export type ProductInput = {
  slug: string; name: string; brand: string; description: string; category: "fragrance" | "accessory";
  images: { id: string; alt: string; url: string; width: number; height: number }[];
  tags: string[]; is_featured: boolean; best_seller: boolean; new_arrival: boolean;
};

function cleanString(value: unknown, max: number, min = 0): value is string {
  return typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
}

function isLocalImage(value: unknown): value is { id: string; alt: string; url: string; width: number; height: number } {
  if (!value || typeof value !== "object") return false;
  const image = value as Record<string, unknown>;
  if (!cleanString(image.id, 120, 1) || !cleanString(image.alt, 240, 1) ||
      typeof image.url !== "string" || !image.url.startsWith("/images/") || image.url.startsWith("//") ||
      image.url.includes("\\") || image.url.includes("?") || image.url.includes("#") ||
      !Number.isInteger(image.width) || !Number.isInteger(image.height) ||
      (image.width as number) < 1 || (image.width as number) > 20_000 ||
      (image.height as number) < 1 || (image.height as number) > 20_000) return false;
  const publicRoot = resolve(process.cwd(), "public");
  const assetPath = resolve(publicRoot, `.${image.url}`);
  const relativePath = relative(publicRoot, assetPath);
  return !isAbsolute(relativePath) && relativePath !== ".." && !relativePath.startsWith(`..${sep}`) && existsSync(assetPath);
}

export function validateProductInput(value: unknown): ProductInput | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (!isSafeProductSlug(input.slug) || !cleanString(input.name, 160, 1) || !cleanString(input.brand, 120, 1) ||
      !cleanString(input.description, 10_000) || (input.category !== "fragrance" && input.category !== "accessory") ||
      !Array.isArray(input.images) || input.images.length > 30 || !input.images.every(isLocalImage) ||
      !Array.isArray(input.tags) || input.tags.length > 40 || !input.tags.every((tag) => cleanString(tag, 80, 1)) ||
      (input.is_featured !== undefined && typeof input.is_featured !== "boolean") ||
      (input.best_seller !== undefined && typeof input.best_seller !== "boolean") ||
      (input.new_arrival !== undefined && typeof input.new_arrival !== "boolean")) return null;
  return {
    slug: input.slug,
    name: input.name.trim(),
    brand: input.brand.trim(),
    description: input.description.trim(),
    category: input.category,
    images: input.images as ProductInput["images"],
    tags: input.tags.map((tag) => (tag as string).trim()),
    is_featured: input.is_featured === true,
    best_seller: input.best_seller === true,
    new_arrival: input.new_arrival === true,
  };
}

export function validateProductPatch(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const allowed = new Set(["name", "brand", "description", "category", "images", "tags", "is_featured", "best_seller", "new_arrival", "is_active"]);
  if (!Object.keys(input).length || Object.keys(input).some((key) => !allowed.has(key))) return null;
  if ("name" in input && !cleanString(input.name, 160, 1)) return null;
  if ("brand" in input && !cleanString(input.brand, 120, 1)) return null;
  if ("description" in input && !cleanString(input.description, 10_000)) return null;
  if ("category" in input && input.category !== "fragrance" && input.category !== "accessory") return null;
  if ("images" in input && (!Array.isArray(input.images) || input.images.length > 30 || !input.images.every(isLocalImage))) return null;
  if ("tags" in input && (!Array.isArray(input.tags) || input.tags.length > 40 || !input.tags.every((tag) => cleanString(tag, 80, 1)))) return null;
  for (const key of ["is_featured", "best_seller", "new_arrival", "is_active"] as const) {
    if (key in input && typeof input[key] !== "boolean") return null;
  }
  return {
    ...input,
    ...(typeof input.name === "string" ? { name: input.name.trim() } : {}),
    ...(typeof input.brand === "string" ? { brand: input.brand.trim() } : {}),
    ...(typeof input.description === "string" ? { description: input.description.trim() } : {}),
    ...(Array.isArray(input.tags) ? { tags: input.tags.map((tag) => (tag as string).trim()) } : {}),
  };
}

export type VariantInput = { name: string; sku: string; price_millimes: number; stock: number; is_default: boolean };
export function validateNewVariant(value: unknown): VariantInput | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (!cleanString(input.name, 120, 1) || typeof input.sku !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(input.sku) ||
      !isValidMillimePrice(input.price_millimes) || !isValidStock(input.stock) || typeof input.is_default !== "boolean") return null;
  return { name: input.name.trim(), sku: input.sku, price_millimes: input.price_millimes, stock: input.stock, is_default: input.is_default };
}

export function validateVariantPatch(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const allowed = new Set(["name", "sku", "price_millimes", "stock", "is_default", "is_active"]);
  if (!Object.keys(input).length || Object.keys(input).some((key) => !allowed.has(key))) return null;
  if ("name" in input && !cleanString(input.name, 120, 1)) return null;
  if ("sku" in input && (typeof input.sku !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(input.sku))) return null;
  if ("price_millimes" in input && !isValidMillimePrice(input.price_millimes)) return null;
  if ("stock" in input && !isValidStock(input.stock)) return null;
  for (const key of ["is_default", "is_active"] as const) if (key in input && typeof input[key] !== "boolean") return null;
  return { ...input, ...(typeof input.name === "string" ? { name: input.name.trim() } : {}) };
}
