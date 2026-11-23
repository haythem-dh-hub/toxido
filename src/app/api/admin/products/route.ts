import { adminJson, authorizeAdminRequest, isAdminIdentity, readJson } from "@/lib/admin-api";
import { listAdminProducts } from "@/lib/admin-data";
import { adminRest } from "@/lib/admin-rest";
import { validateProductInput } from "@/lib/admin-validation";

export async function GET(request: Request) {
  const auth = await authorizeAdminRequest(request);
  if (!isAdminIdentity(auth)) return auth;
  try { return adminJson({ products: await listAdminProducts() }); }
  catch { return adminJson({ error: "Products are temporarily unavailable." }, 503); }
}

export async function POST(request: Request) {
  const auth = await authorizeAdminRequest(request, true);
  if (!isAdminIdentity(auth)) return auth;
  const body = await readJson(request);
  const product = validateProductInput(body);
  if (!product) return adminJson({ error: "Product details or image paths are invalid." }, 400);
  try {
    const response = await adminRest("products?select=id,slug,name,is_active", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ ...product, is_active: false }),
    });
    if (response.status === 409) return adminJson({ error: "A product with that slug already exists." }, 409);
    if (!response.ok) return adminJson({ error: "Product could not be created." }, 503);
    const rows = await response.json() as unknown;
    return Array.isArray(rows) && rows[0] ? adminJson({ product: rows[0] }, 201) : adminJson({ error: "Product creation could not be confirmed." }, 503);
  } catch {
    return adminJson({ error: "Product could not be created." }, 503);
  }
}
