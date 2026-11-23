import { adminJson, authorizeAdminRequest, isAdminIdentity, readJson } from "@/lib/admin-api";
import { getAdminProduct } from "@/lib/admin-data";
import { adminRest } from "@/lib/admin-rest";
import { isUuid, validateNewVariant } from "@/lib/admin-validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdminRequest(request, true);
  if (!isAdminIdentity(auth)) return auth;
  const { id } = await params;
  if (!isUuid(id)) return adminJson({ error: "Product not found." }, 404);
  const body = await readJson(request);
  const variant = validateNewVariant(body);
  if (!variant) return adminJson({ error: "Variant details are invalid." }, 400);

  try {
    const product = await getAdminProduct(id);
    if (!product) return adminJson({ error: "Product not found." }, 404);
    if (variant.is_default && product.product_variants.some((item) => item.is_default)) {
      return adminJson({ error: "This product already has a default variant. Change the existing default first." }, 409);
    }
    const response = await adminRest("product_variants?select=id,product_id,name,sku,price_millimes,currency,stock,is_default,is_active", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ ...variant, product_id: id, currency: "TND", is_active: false }),
    });
    if (response.status === 409) return adminJson({ error: "That SKU already exists." }, 409);
    if (!response.ok) return adminJson({ error: "Variant could not be created." }, 503);
    const rows = await response.json() as unknown;
    return Array.isArray(rows) && rows[0] ? adminJson({ variant: rows[0] }, 201) : adminJson({ error: "Variant creation could not be confirmed." }, 503);
  } catch {
    return adminJson({ error: "Variant could not be created." }, 503);
  }
}
