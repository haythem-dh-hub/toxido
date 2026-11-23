import { adminJson, authorizeAdminRequest, isAdminIdentity, readJson } from "@/lib/admin-api";
import { getAdminOrder } from "@/lib/admin-data";
import { isDatabaseOrderStatus } from "@/features/admin/admin-security";
import { isUuid } from "@/lib/admin-validation";
import { adminRest } from "@/lib/admin-rest";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdminRequest(request);
  if (!isAdminIdentity(auth)) return auth;
  const { id } = await params;
  if (!isUuid(id)) return adminJson({ error: "Order not found." }, 404);
  try {
    const result = await getAdminOrder(id);
    return result.order ? adminJson(result) : adminJson({ error: "Order not found." }, 404);
  } catch {
    return adminJson({ error: "Order details are temporarily unavailable." }, 503);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdminRequest(request, true);
  if (!isAdminIdentity(auth)) return auth;
  const { id } = await params;
  if (!isUuid(id)) return adminJson({ error: "Order not found." }, 404);
  const body = await readJson(request);
  if (!body || typeof body !== "object" || !isDatabaseOrderStatus((body as { status?: unknown }).status)) {
    return adminJson({ error: "Choose a status allowed by the database." }, 400);
  }
  let currentOrder;
  try { currentOrder = (await getAdminOrder(id)).order; }
  catch { return adminJson({ error: "Order status could not be verified." }, 503); }
  if (!currentOrder) return adminJson({ error: "Order not found." }, 404);
  const nextStatus = (body as { status: string }).status;
  if (currentOrder.payment_method === "flouci" && currentOrder.payment_status !== "paid") {
    return adminJson({ error: "A Flouci order must have verified payment before its order status can change." }, 409);
  }
  if (currentOrder.payment_method === "flouci" && nextStatus === "cancelled") {
    return adminJson({ error: "Refund the verified Flouci payment before cancelling this order." }, 409);
  }
  const paramsQuery = new URLSearchParams({ id: `eq.${id}`, select: "id,reference,status" });
  try {
    const response = await adminRest(`orders?${paramsQuery.toString()}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: (body as { status: string }).status }),
    });
    if (!response.ok) return adminJson({ error: "Order status could not be updated." }, 503);
    const rows = await response.json() as unknown;
    if (!Array.isArray(rows) || !rows[0]) return adminJson({ error: "Order not found." }, 404);
    return adminJson({ order: rows[0] });
  } catch {
    return adminJson({ error: "Order status could not be updated." }, 503);
  }
}
