export type ProductCategory = "fragrance" | "accessory";
export type FragranceFamily = "woody" | "fresh" | "spicy" | "sweet" | "oriental" | "citrus" | "smoky";
export type ProductOccasion = "daily" | "office" | "date-night" | "party" | "business" | "special-event";
export type ProductSeason = "spring" | "summer" | "fall" | "winter";

export interface Money {
  amount: number;
  currency: "TND" | "USD";
}

export interface ProductImage {
  id: string;
  alt: string;
  url: string;
  width: number;
  height: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price: Money;
  salePrice?: Money;
  stock: number;
  size?: string;
}

export interface FragranceProfile {
  family: FragranceFamily;
  topNotes: string[];
  middleNotes: string[];
  baseNotes: string[];
  longevity: number;
  projection: number;
  versatility: number;
  seasons: ProductSeason[];
  occasions: ProductOccasion[];
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  description: string;
  category: ProductCategory;
  images: ProductImage[];
  variants: ProductVariant[];
  fragrance?: FragranceProfile;
  tags: string[];
  featured: boolean;
  bestSeller: boolean;
  newArrival: boolean;
  createdAt: string;
}
