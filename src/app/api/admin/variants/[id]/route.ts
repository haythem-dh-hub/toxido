import { adminJson, authorizeAdminRequest, isAdminIdentity, readJson } from "@/lib/admin-api";
import { getAdminProduct } from "@/lib/admin-data";
import { adminRest } from "@/lib/admin-rest";
import { validateVariantPatch, isUuid } from "@/lib/admin-validation";

type VariantRow = { id: string; product_id: string; name: string; sku: string; price_millimes: number; stock: number; is_default: boolean; is_active: boolean };

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdminRequest(request, true);
  if (!isAdminIdentity(auth)) return auth;
  const { id } = await params;
  if (!isUuid(id)) return adminJson({ error: "Variant not found." }, 404);
  const body = await readJson(request);
  const patch = validateVariantPatch(body);
  if (!patch) return adminJson({ error: "Variant update contains invalid or unsupported fields." }, 400);

  try {
    const variantParams = new URLSearchParams({ id: `eq.${id}`, select: "id,product_id,name,sku,price_millimes,stock,is_default,is_active", limit: "1" });
    const getResponse = await adminRest(`product_variants?${variantParams.toString()}`);
    if (!getResponse.ok) return adminJson({ error: "Variant is temporarily unavailable." }, 503);
    const rows = await getResponse.json() as VariantRow[];
    const current = rows[0];
    if (!current) return adminJson({ error: "Variant not found." }, 404);

    const product = await getAdminProduct(current.product_id);
    if (!product) return adminJson({ error: "Product not found." }, 404);
    const nextDefault = typeof patch.is_default === "boolean" ? patch.is_default : current.is_default;
    const nextActive = typeof patch.is_active === "boolean" ? patch.is_active : current.is_active;
    const siblings = product.product_variants.filter((variant) => variant.id !== id);
    if (nextDefault && siblings.some((variant) => variant.is_default)) {
      return adminJson({ error: "This product already has a default variant. Change the existing default first." }, 409);
    }
    if (product.is_active && current.is_active && current.is_default && (!nextActive || !nextDefault) &&
        !siblings.some((variant) => variant.is_active && variant.is_default)) {
      return adminJson({ error: "Deactivate the product or choose another active default before disabling this variant." }, 409);
    }

    const query = new URLSearchParams({ id: `eq.${id}`, select: "id,product_id,name,sku,price_millimes,currency,stock,is_default,is_active" });
    query.set("stock", `eq.${current.stock}`);
    query.set("price_millimes", `eq.${current.price_millimes}`);
    const response = await adminRest(`product_variants?${query.toString()}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    });
    if (response.status === 409) return adminJson({ error: "A SKU or default-variant constraint was violated." }, 409);
    if (!response.ok) return adminJson({ error: "Variant could not be updated." }, 503);
    const updated = await response.json() as unknown;
    if (!Array.isArray(updated) || !updated[0]) return adminJson({ error: "Variant changed while you were editing. Refresh and retry." }, 409);
    return adminJson({ variant: updated[0] });
  } catch {
    return adminJson({ error: "Variant could not be updated." }, 503);
  }
}
