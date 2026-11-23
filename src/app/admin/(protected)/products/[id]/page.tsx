import { notFound } from "next/navigation";
import { AdminProductEditor } from "@/components/admin/admin-product-editor";
import { getAdminProduct } from "@/lib/admin-data";
import { isUuid } from "@/lib/admin-validation";
import { getAdminIdentity } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

export default async function AdminProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  if (!await getAdminIdentity()) redirect("/admin/login");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const product = await getAdminProduct(id);
  if (!product) notFound();
  return <AdminProductEditor initialProduct={product} />;
}
