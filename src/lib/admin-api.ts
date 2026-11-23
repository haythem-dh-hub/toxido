import "server-only";

import { NextResponse } from "next/server";
import { getAdminIdentity, type AdminIdentity } from "@/lib/admin-auth";

export function adminJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function authorizeAdminRequest(request: Request, mutation = false): Promise<AdminIdentity | NextResponse> {
  if (mutation && request.headers.get("origin") !== new URL(request.url).origin) {
    return adminJson({ error: "Invalid request origin." }, 403);
  }
  const identity = await getAdminIdentity();
  return identity ?? adminJson({ error: "Administrator authentication required." }, 401);
}

export function isAdminIdentity(value: AdminIdentity | NextResponse): value is AdminIdentity {
  return !(value instanceof NextResponse);
}

export async function readJson(request: Request): Promise<unknown | null> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 65_536) return null;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 65_536) return null;
    return JSON.parse(text) as unknown;
  } catch { return null; }
}
