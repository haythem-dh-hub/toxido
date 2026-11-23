import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, getAdminIdentity, isConfiguredAdmin } from "@/lib/admin-auth";
import { adminJson } from "@/lib/admin-api";
import { getSupabaseSettings } from "@/lib/supabase-server";

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

function sameOrigin(request: Request): boolean {
  return request.headers.get("origin") === new URL(request.url).origin;
}

// export async function GET() {
//   const identity = await getAdminIdentity();
//   return identity ? adminJson({ user: identity }) : adminJson({ user: null }, 401);
// }

export async function GET() {
  try {
    const identity = await getAdminIdentity();

    return identity
      ? adminJson({ user: identity })
      : adminJson({ user: null }, 401);
  } catch {
    return adminJson(
      { error: "Administrator authentication is temporarily unavailable." },
      503,
    );
  }
}


export async function POST(request: Request) {
  if (!sameOrigin(request)) return adminJson({ error: "Invalid request origin." }, 403);
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 4_096) return adminJson({ error: "Invalid login request." }, 400);

  let body: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 4_096) return adminJson({ error: "Invalid login request." }, 400);
    body = JSON.parse(text) as unknown;
  } catch { return adminJson({ error: "Enter a valid email and password." }, 400); }
  if (!body || typeof body !== "object") return adminJson({ error: "Enter a valid email and password." }, 400);
  const credentials = body as { email?: unknown; password?: unknown };
  const email = typeof credentials.email === "string" ? credentials.email.trim().toLowerCase() : "";
  const password = typeof credentials.password === "string" ? credentials.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 1 || password.length > 1_024) {
    return adminJson({ error: "Enter a valid email and password." }, 400);
  }

  const settings = getSupabaseSettings();
  if (!settings) return adminJson({ error: "Administrator sign-in is unavailable." }, 503);
  try {
    const response = await fetch(new URL("/auth/v1/token?grant_type=password", settings.url), {
      method: "POST",
      headers: { apikey: settings.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
      // signal: AbortSignal.timeout(8_000),
      signal: AbortSignal.timeout(15_000),
    });
    // if (!response.ok) return adminJson({ error: "Sign-in failed or this account is not authorized." }, 401);
    if (!response.ok) {
  if (
    response.status === 408 ||
    response.status === 429 ||
    response.status >= 500
  ) {
    return adminJson(
      { error: "Administrator authentication is temporarily unavailable." },
      503,
    );
  }

  return adminJson(
    { error: "Sign-in failed or this account is not authorized." },
    401,
  );
}
    const session = await response.json() as { access_token?: unknown; expires_in?: unknown; user?: { id?: unknown; email?: unknown } };
    if (typeof session.access_token !== "string" || !Number.isInteger(session.expires_in) || !isConfiguredAdmin(session.user?.id)) {
      return adminJson({ error: "Sign-in failed or this account is not authorized." }, 401);
    }

    const maxAge = Math.max(1, Math.min(session.expires_in as number, 3_600));
    const result = NextResponse.json({ user: { id: session.user.id, email: typeof session.user.email === "string" ? session.user.email : email } }, {
      headers: { "Cache-Control": "no-store" },
    });
    result.cookies.set(ADMIN_SESSION_COOKIE, session.access_token, cookieOptions(maxAge));
    return result;
  } catch {
    return adminJson({ error: "Administrator sign-in is temporarily unavailable." }, 503);
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return adminJson({ error: "Invalid request origin." }, 403);
  const response = adminJson({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", cookieOptions(0));
  return response;
}
