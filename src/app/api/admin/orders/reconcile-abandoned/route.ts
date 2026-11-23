import { adminJson, authorizeAdminRequest, isAdminIdentity } from "@/lib/admin-api";
import { reconcileAbandonedFlouciSessions } from "@/features/payments/flouci-abandoned-reconciliation";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

export async function POST(request: Request) {
  const isCron = isAuthorizedCronRequest(request);
  if (!isCron) {
    const auth = await authorizeAdminRequest(request, true);
    if (!isAdminIdentity(auth)) return auth;
  }

  try {
    const report = await reconcileAbandonedFlouciSessions(25);
    return adminJson({ data: report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reconciliation failed.";
    return adminJson({ error: message }, 503);
  }
}
