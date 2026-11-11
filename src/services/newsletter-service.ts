import type { ApiResponse } from "@/types/api";

export async function subscribeToNewsletter(_email: string): Promise<ApiResponse<never>> {
  void _email;
  return {
    error: {
      code: "NEWSLETTER_SERVICE_UNAVAILABLE",
      message: "Newsletter sign-up is not connected. Your email was not saved or sent.",
    },
  };
}
