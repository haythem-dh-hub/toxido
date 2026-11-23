import "server-only";

import { adminRest } from "@/lib/admin-rest";
import type { DatabaseOrderStatus } from "@/features/admin/admin-security";

const ORDER_SELECT = "id,reference,status,customer_name,customer_email,customer_phone,delivery_address,delivery_city,delivery_governorate,payment_method,payment_status,shipping_millimes,currency,total_millimes,discount_millimes,promotion_code,created_at,flouci_tracking_id,flouci_payment_id,inventory_released_at,flouci_review_reason";
const PAGE_SIZE = 1000;

async function rows<T>(path: string): Promise<T[]> {
  const response = await adminRest(path);
  if (!response.ok) throw new Error("ADMIN_DATABASE_READ_FAILED");
  const value = await response.json() as unknown;
  if (!Array.isArray(value)) throw new Error("ADMIN_DATABASE_RESPONSE_INVALID");
  return value as T[];
}

export type AdminOrder = {
  id: string; reference: string; status: DatabaseOrderStatus; customer_name: string;
  customer_email: string | null; customer_phone: string; delivery_address: string;
  delivery_city: string; delivery_governorate: string; payment_method: string;
  payment_status: "cod_due" | "pending" | "paid" | "failed" | "expired" | "review_required"; shipping_millimes: string | number;
  flouci_tracking_id: string | null; flouci_payment_id: string | null; inventory_released_at: string | null; flouci_review_reason: string | null;
  currency: "TND"; total_millimes: string | number; discount_millimes?: string | number;
  promotion_code?: string | null; created_at: string;
};

export type AdminOrderItem = {
  id: string; product_name: string; product_slug: string; brand_name: string;
  variant_name: string; sku: string; image_url: string | null; unit_price_millimes: string | number;
  quantity: number; line_total_millimes: string | number; currency: "TND"; promotion_code?: string | null;
};

export type AdminVariant = {
  id: string; name: string; sku: string; price_millimes: string | number; currency: "TND";
  stock: number; is_default: boolean; is_active: boolean;
};

export type AdminProduct = {
  id: string; slug: string; name: string; brand: string; description: string;
  category: "fragrance" | "accessory"; images: { id: string; alt: string; url: string; width: number; height: number }[];
  tags: string[]; is_featured: boolean; best_seller: boolean; new_arrival: boolean;
  is_active: boolean; product_variants: AdminVariant[];
};

export async function getOverviewData() {
  const allOrders: Pick<AdminOrder, "status" | "total_millimes">[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await rows<Pick<AdminOrder, "status" | "total_millimes">>(
      `orders?select=status,total_millimes&order=created_at.asc&limit=${PAGE_SIZE}&offset=${offset}`,
    );
    allOrders.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const thresholdRaw = process.env.ADMIN_LOW_STOCK_THRESHOLD;
  const threshold = thresholdRaw && /^\d+$/.test(thresholdRaw) ? Number(thresholdRaw) : null;
  const lowStock: { product: string; slug: string; variant: string; sku: string; stock: number }[] = [];
  if (threshold !== null && Number.isSafeInteger(threshold) && threshold >= 0) {
    const products: { slug: string; name: string; product_variants: Pick<AdminVariant, "name" | "sku" | "stock">[] }[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = await rows<(typeof products)[number]>(`products?select=slug,name,product_variants(name,sku,stock)&order=slug.asc&limit=${PAGE_SIZE}&offset=${offset}`);
      products.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    for (const product of products) for (const variant of product.product_variants ?? []) {
      if (variant.stock <= threshold) lowStock.push({ product: product.name, slug: product.slug, variant: variant.name, sku: variant.sku, stock: variant.stock });
    }
  }

  const count = (status: DatabaseOrderStatus) => allOrders.filter((order) => order.status === status).length;
  const fulfilledRevenue = allOrders
    .filter((order) => order.status === "fulfilled")
    .reduce((sum, order) => sum + BigInt(order.total_millimes), BigInt(0));
  return {
    totalOrders: allOrders.length,
    pendingOrders: count("pending"),
    confirmedOrders: count("confirmed"),
    completedOrders: count("fulfilled"),
    fulfilledRevenueMillimes: fulfilledRevenue.toString(),
    lowStockThreshold: threshold !== null && Number.isSafeInteger(threshold) && threshold >= 0 ? threshold : null,
    lowStock,
  };
}

export async function listAdminOrders(status?: DatabaseOrderStatus): Promise<AdminOrder[]> {
  const params = new URLSearchParams({ select: ORDER_SELECT, order: "created_at.desc", limit: "500" });
  if (status) params.set("status", `eq.${status}`);
  return rows<AdminOrder>(`orders?${params.toString()}`);
}

export async function getAdminOrder(id: string): Promise<{ order: AdminOrder | null; items: AdminOrderItem[] }> {
  const params = new URLSearchParams({ select: ORDER_SELECT, id: `eq.${id}`, limit: "1" });
  const [order] = await rows<AdminOrder>(`orders?${params.toString()}`);
  if (!order) return { order: null, items: [] };
  const itemParams = new URLSearchParams({
    select: "id,product_name,product_slug,brand_name,variant_name,sku,image_url,unit_price_millimes,quantity,line_total_millimes,currency,promotion_code",
    order_id: `eq.${id}`,
    order: "created_at.asc",
  });
  return { order, items: await rows<AdminOrderItem>(`order_items?${itemParams.toString()}`) };
}

export async function listAdminProducts(): Promise<AdminProduct[]> {
  const params = new URLSearchParams({
    select: "id,slug,name,brand,description,category,images,tags,is_featured,best_seller,new_arrival,is_active,product_variants(id,name,sku,price_millimes,currency,stock,is_default,is_active)",
    order: "created_at.desc",
  });
  const products: AdminProduct[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const pageParams = new URLSearchParams(params);
    pageParams.set("limit", String(PAGE_SIZE));
    pageParams.set("offset", String(offset));
    const page = await rows<AdminProduct>(`products?${pageParams.toString()}`);
    products.push(...page);
    if (page.length < PAGE_SIZE) return products;
  }
}

export async function getAdminProduct(id: string): Promise<AdminProduct | null> {
  const params = new URLSearchParams({
    select: "id,slug,name,brand,description,category,images,tags,is_featured,best_seller,new_arrival,is_active,product_variants(id,name,sku,price_millimes,currency,stock,is_default,is_active)",
    id: `eq.${id}`,
    limit: "1",
  });
  const [product] = await rows<AdminProduct>(`products?${params.toString()}`);
  return product ?? null;
}
