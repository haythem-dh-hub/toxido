import { adminJson, authorizeAdminRequest, isAdminIdentity, readJson } from "@/lib/admin-api";
import { getAdminProduct } from "@/lib/admin-data";
import { adminRest } from "@/lib/admin-rest";
import { isUuid, validateProductPatch } from "@/lib/admin-validation";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdminRequest(request);
  if (!isAdminIdentity(auth)) return auth;
  const { id } = await params;
  if (!isUuid(id)) return adminJson({ error: "Product not found." }, 404);
  try {
    const product = await getAdminProduct(id);
    return product ? adminJson({ product }) : adminJson({ error: "Product not found." }, 404);
  } catch {
    return adminJson({ error: "Product is temporarily unavailable." }, 503);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdminRequest(request, true);
  if (!isAdminIdentity(auth)) return auth;
  const { id } = await params;
  if (!isUuid(id)) return adminJson({ error: "Product not found." }, 404);
  const body = await readJson(request);
  const patch = validateProductPatch(body);
  if (!patch) return adminJson({ error: "Product update contains invalid or unsupported fields." }, 400);

  try {
    const current = await getAdminProduct(id);
    if (!current) return adminJson({ error: "Product not found." }, 404);
    if (patch.is_active === true || current.is_active) {
      const images = (patch.images as typeof current.images | undefined) ?? current.images;
      const variants = current.product_variants ?? [];
      if (images.length === 0 || !variants.some((variant) => variant.is_active && variant.is_default)) {
        return adminJson({ error: "Add a real product image and activate one default variant before activating this product." }, 409);
      }
    }
    const query = new URLSearchParams({ id: `eq.${id}`, select: "id,slug,name,category,images,is_active" });
    const response = await adminRest(`products?${query.toString()}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    });
    if (!response.ok) return adminJson({ error: "Product could not be updated." }, 503);
    const rows = await response.json() as unknown;
    return Array.isArray(rows) && rows[0] ? adminJson({ product: rows[0] }) : adminJson({ error: "Product not found." }, 404);
  } catch {
    return adminJson({ error: "Product could not be updated." }, 503);
  }
}
