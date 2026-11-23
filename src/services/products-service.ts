import { catalogProducts } from "@/features/products/mock-products";
import { moneyFromMillimes } from "@/features/products/variant-pricing";
import { getSupabaseSettings } from "@/lib/supabase-server";
import type { FragranceProfile, Product, ProductImage, ProductVariant } from "@/types/product";

type DatabaseVariant = {
  id: string; name: string; sku: string; price_millimes: number; currency: "TND";
  stock: number; is_active: boolean; is_default: boolean;
};
type DatabaseProduct = {
  id: string; slug: string; name: string; brand: string; description: string;
  category: Product["category"]; product_categories: { slug: Product["category"]; name: string } | null;
  images: ProductImage[]; tags: string[];
  is_featured: boolean; best_seller: boolean; new_arrival: boolean;
  fragrance_profile: FragranceProfile | null; created_at: string; product_variants: DatabaseVariant[];
};

export async function getCatalogProducts(): Promise<{ products: Product[]; isDemo: boolean }> {
  const settings = getSupabaseSettings();
  if (!settings) return process.env.NODE_ENV === "production"
    ? { products: [], isDemo: false }
    : { products: catalogProducts, isDemo: true };

  const select = "id,slug,name,brand,description,category,product_categories(slug,name),images,tags,is_featured,best_seller,new_arrival,fragrance_profile,created_at,product_variants(id,name,sku,price_millimes,currency,stock,is_active,is_default)";
  let response: Response;
  try {
    response = await fetch(new URL(`/rest/v1/products?select=${select}&is_active=eq.true&order=name.asc&product_variants.is_active=eq.true&product_variants.order=is_default.desc`, settings.url), {
      headers: { apikey: settings.anonKey, Authorization: `Bearer ${settings.anonKey}` },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    return { products: [], isDemo: false };
  }
  if (!response.ok) return { products: [], isDemo: false };

  const rows = await response.json().catch(() => null) as DatabaseProduct[] | null;
  if (!Array.isArray(rows)) return { products: [], isDemo: false };
  const products = rows.flatMap((row): Product[] => {
    if (!row.id || !row.slug || !Array.isArray(row.product_variants)) return [];
    const variants: ProductVariant[] = row.product_variants.filter((variant) => variant.is_active).sort((a, b) => Number(b.is_default) - Number(a.is_default)).map((variant) => ({
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      size: variant.name,
      price: moneyFromMillimes(Number(variant.price_millimes)),
      stock: variant.stock,
    }));
    return [{
      id: row.id,
      slug: row.slug,
      name: row.name,
      brand: row.brand,
      description: row.description,
      category: row.category,
      images: Array.isArray(row.images) ? row.images.filter((image) => image && typeof image.id === "string" && typeof image.alt === "string" && typeof image.url === "string" && image.url.startsWith("/") && !image.url.startsWith("//") && Number.isInteger(image.width) && Number.isInteger(image.height)) : [],
      variants,
      fragrance: row.fragrance_profile ?? undefined,
      tags: Array.isArray(row.tags) ? row.tags : [],
      featured: row.is_featured,
      bestSeller: row.best_seller,
      newArrival: row.new_arrival,
      createdAt: row.created_at,
    }];
  }).filter((product) => product.variants[0] && rows.some((row) => row.slug === product.slug && row.product_variants.some((variant) => variant.is_default && variant.is_active)));
  return { products, isDemo: false };
}

export async function getProductBySlug(slug: string): Promise<{ product: Product | null; isDemo: boolean }> {
  const { products, isDemo } = await getCatalogProducts();
  return { product: products.find((product) => product.slug === slug) ?? null, isDemo };
}
