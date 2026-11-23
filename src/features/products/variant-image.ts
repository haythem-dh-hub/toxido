import type { ProductImage, ProductVariant } from "@/types/product";

/** Selects the database image tagged with the selected variant's ml size. */
export function imageForVariant(images: ProductImage[], variant?: ProductVariant): ProductImage | undefined {
  if (images.length <= 1 || !variant) return images[0];

  const sizeInMl = (variant.size ?? variant.name).match(/(\d+(?:\.\d+)?)\s*ml\b/i)?.[1];
  if (!sizeInMl) return images[0];

  return images.find((image) => [image.id, image.alt].some((value) =>
    value.toLowerCase().split(/[^a-z0-9.]+/).includes(sizeInMl.toLowerCase()),
  )) ?? images[0];
}
