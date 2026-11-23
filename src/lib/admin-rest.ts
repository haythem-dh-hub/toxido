import "server-only";

import { getSupabaseSettings } from "@/lib/supabase-server";

export async function adminRest(path: string, init: RequestInit = {}): Promise<Response> {
  const settings = getSupabaseSettings(true);
  if (!settings?.serviceRoleKey || !settings.serviceRoleKeyKind) {
    throw new Error("ADMIN_SERVICE_UNAVAILABLE");
  }
  const headers = new Headers(init.headers);
  headers.set("apikey", settings.serviceRoleKey);
  if (settings.serviceRoleKeyKind === "legacy-service-role-jwt") {
    headers.set("Authorization", `Bearer ${settings.serviceRoleKey}`);
  }
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(new URL(`/rest/v1/${path.replace(/^\//, "")}`, settings.url), {
    ...init,
    headers,
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(8_000),
  });
}
