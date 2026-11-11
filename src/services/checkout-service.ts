import type { ApiResponse } from "@/types/api";
import type { CartItem } from "@/features/cart/commerce-provider";

export interface CheckoutSubmission {
  customer: { fullName: string; email: string; phone: string; address: string; city: string };
  items: CartItem[];
}

export async function submitOrder(_submission: CheckoutSubmission): Promise<ApiResponse<never>> {
  void _submission;
  return {
    error: {
      code: "ORDER_SERVICE_UNAVAILABLE",
      message: "Ordering is not available yet. No order was placed and your details were not sent.",
    },
  };
}
