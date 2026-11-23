// import "server-only";

// import { cookies } from "next/headers";
// import { getSupabaseSettings } from "@/lib/supabase-server";
// import { isAllowedAdminId } from "@/features/admin/admin-security";

// export const ADMIN_SESSION_COOKIE = "toxido_admin_access";
// export type AdminIdentity = { id: string; email: string };

// export function isConfiguredAdmin(userId: unknown): userId is string {
//   return isAllowedAdminId(userId, process.env.ADMIN_USER_IDS);
// }

// export async function verifyAdminAccessToken(accessToken: string): Promise<AdminIdentity | null> {
//   const settings = getSupabaseSettings();
//   if (!settings || !accessToken) return null;
//   try {
//     const response = await fetch(new URL("/auth/v1/user", settings.url), {
//       headers: { apikey: settings.anonKey, Authorization: `Bearer ${accessToken}` },
//       cache: "no-store",
//       signal: AbortSignal.timeout(5_000),
//     });
//     if (!response.ok) return null;
//     const user = await response.json() as { id?: unknown; email?: unknown };
//     if (!isConfiguredAdmin(user.id)) return null;
//     return { id: user.id, email: typeof user.email === "string" ? user.email : "" };
//   } catch {
//     return null;
//   }
// }

// export async function getAdminIdentity(): Promise<AdminIdentity | null> {
//   const accessToken = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
//   return accessToken ? verifyAdminAccessToken(accessToken) : null;
// }

import "server-only";

import { cookies } from "next/headers";
import { getSupabaseSettings } from "@/lib/supabase-server";
import { isAllowedAdminId } from "@/features/admin/admin-security";

export const ADMIN_SESSION_COOKIE = "toxido_admin_access";

export type AdminIdentity = {
  id: string;
  email: string;
};

export class AdminAuthUnavailableError extends Error {
  constructor() {
    super("Administrator authentication service is unavailable.");
    this.name = "AdminAuthUnavailableError";
  }
}

export function isConfiguredAdmin(userId: unknown): userId is string {
  return isAllowedAdminId(userId, process.env.ADMIN_USER_IDS);
}

export async function verifyAdminAccessToken(
  accessToken: string,
): Promise<AdminIdentity | null> {
  if (!accessToken) return null;

  const settings = getSupabaseSettings();

  if (!settings) {
    throw new AdminAuthUnavailableError();
  }

  let response: Response;

  try {
    response = await fetch(new URL("/auth/v1/user", settings.url), {
      headers: {
        apikey: settings.anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new AdminAuthUnavailableError();
  }

  // Only a rejected/expired token is an authentication failure.
  if (response.status === 401 || response.status === 403) {
    return null;
  }

  // Rate limits, server errors and unexpected responses are service failures.
  if (!response.ok) {
    throw new AdminAuthUnavailableError();
  }

  let user: { id?: unknown; email?: unknown };

  try {
    user = await response.json();
  } catch {
    throw new AdminAuthUnavailableError();
  }

  if (typeof user.id !== "string") {
    throw new AdminAuthUnavailableError();
  }

  if (!isConfiguredAdmin(user.id)) {
    return null;
  }

  return {
    id: user.id,
    email: typeof user.email === "string" ? user.email : "",
  };
}

export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  const accessToken = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;

  return accessToken
    ? verifyAdminAccessToken(accessToken)
    : null;
}