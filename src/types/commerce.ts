import type { Money, ProductImage } from "@/types/product";

export interface CartLine {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  variantName: string;
  quantity: number;
  unitPrice: Money;
  image: ProductImage;
}

export interface Cart {
  id: string;
  lines: CartLine[];
  subtotal: Money;
  updatedAt: string;
}

export interface Address {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  country: string;
  isDefault: boolean;
}

export interface Customer {
  id: string;
  email: string;
  name: string;
  addresses: Address[];
}

export type OrderStatus = "pending" | "paid" | "processing" | "shipped" | "delivered" | "cancelled";

export interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  lines: CartLine[];
  total: Money;
  createdAt: string;
}
