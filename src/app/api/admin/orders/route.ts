import { adminJson, authorizeAdminRequest, isAdminIdentity } from "@/lib/admin-api";
import { listAdminOrders } from "@/lib/admin-data";
import { isDatabaseOrderStatus, type DatabaseOrderStatus } from "@/features/admin/admin-security";

export async function GET(request: Request) {
  const auth = await authorizeAdminRequest(request);
  if (!isAdminIdentity(auth)) return auth;
  const params = new URL(request.url).searchParams;
  const statusParam = params.get("status");
  if (statusParam && !isDatabaseOrderStatus(statusParam)) return adminJson({ error: "Invalid order status filter." }, 400);
  const query = (params.get("q") ?? "").trim().slice(0, 120).toLocaleLowerCase();
  try {
    const orders = await listAdminOrders(statusParam ? statusParam as DatabaseOrderStatus : undefined);
    const filtered = query ? orders.filter((order) => [order.reference, order.customer_name, order.customer_phone, order.delivery_city, order.delivery_governorate]
      .some((field) => field?.toLocaleLowerCase().includes(query))) : orders;
    return adminJson({ orders: filtered });
  } catch {
    return adminJson({ error: "Orders are temporarily unavailable." }, 503);
  }
}
