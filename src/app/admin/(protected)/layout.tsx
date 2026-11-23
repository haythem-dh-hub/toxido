import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminIdentity } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const identity = await getAdminIdentity();
  if (!identity) redirect("/admin/login");
  return <AdminShell email={identity.email}>{children}</AdminShell>;
}
