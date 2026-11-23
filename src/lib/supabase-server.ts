import "server-only";

export type SupabaseServiceKeyKind = "secret" | "legacy-service-role-jwt";

export type SupabaseSettings = {
  url: URL;
  anonKey: string;
  serviceRoleKey?: string;
  serviceRoleKeyKind?: SupabaseServiceKeyKind;
};

const newKeyPattern = /^sb_(publishable|secret)_[A-Za-z0-9_-]{22}_[A-Za-z0-9_-]{8}$/;

function hasLegacyRole(key: string, role: "anon" | "service_role"): boolean {
  const parts = key.split(".");
  if (parts.length !== 3 || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return false;

  try {
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { role?: unknown };
    return claims.role === role;
  } catch {
    return false;
  }
}

function isSupportedAnonKey(key: string): boolean {
  return (newKeyPattern.test(key) && key.startsWith("sb_publishable_")) || hasLegacyRole(key, "anon");
}

function getServiceKeyKind(key: string): SupabaseServiceKeyKind | null {
  if (newKeyPattern.test(key) && key.startsWith("sb_secret_")) return "secret";
  if (hasLegacyRole(key, "service_role")) return "legacy-service-role-jwt";
  return null;
}

export function getSupabaseSettings(requireServiceRole = false): SupabaseSettings | null {
  const rawUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const serviceRoleKeyKind = serviceRoleKey ? getServiceKeyKind(serviceRoleKey) : null;
  if (!rawUrl || !anonKey || !isSupportedAnonKey(anonKey) ||
      (requireServiceRole && (!serviceRoleKey || serviceRoleKey === anonKey || !serviceRoleKeyKind))) return null;

  try {
    const url = new URL(rawUrl);
    const isLocalDevelopmentHttp = process.env.NODE_ENV !== "production" &&
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if ((url.protocol !== "https:" && !isLocalDevelopmentHttp) || url.username || url.password) return null;
    return {
      url,
      anonKey,
      ...(requireServiceRole && serviceRoleKey && serviceRoleKeyKind ? { serviceRoleKey, serviceRoleKeyKind } : {}),
    };
  } catch {
    return null;
  }
}

export function normalizeWhatsAppNumber(value = process.env.ADMIN_WHATSAPP_NUMBER): string | null {
  const number = value?.replace(/[^0-9]/g, "") ?? "";
  return /^\d{8,15}$/.test(number) ? number : null;
}
