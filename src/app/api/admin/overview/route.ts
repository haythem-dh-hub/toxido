import { adminJson, authorizeAdminRequest, isAdminIdentity } from "@/lib/admin-api";
import { getOverviewData } from "@/lib/admin-data";

export async function GET(request: Request) {
  const auth = await authorizeAdminRequest(request);
  if (!isAdminIdentity(auth)) return auth;
  try { return adminJson(await getOverviewData()); }
  catch { return adminJson({ error: "Dashboard data is temporarily unavailable." }, 503); }
}
