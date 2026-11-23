import "server-only";

import { adminRest } from "@/lib/admin-rest";

const FLOUCI_API = "https://developers.flouci.com/api/v2";

export type FlouciSettings = { publicKey: string; privateKey: string; siteUrl: URL };

export function getFlouciSettings(): FlouciSettings | null {
  const publicKey = process.env.FLOUCI_PUBLIC_KEY?.trim();
  const privateKey = process.env.FLOUCI_PRIVATE_KEY?.trim();
  const siteValue = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!publicKey || !privateKey || !siteValue) return null;
  try {
    const siteUrl = new URL(siteValue);
    const localHttp = process.env.NODE_ENV !== "production" && siteUrl.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(siteUrl.hostname);
    if ((siteUrl.protocol !== "https:" && !localHttp) || siteUrl.username || siteUrl.password ||
        siteUrl.pathname !== "/" || siteUrl.search || siteUrl.hash) return null;
    return { publicKey, privateKey, siteUrl };
  } catch {
    return null;
  }
}

export async function flouciGeneratePayment(settings: FlouciSettings, input: {
  amountMillimes: number; trackingId: string; successUrl: string; failUrl: string; webhookUrl: string;
}) {
  return fetch(`${FLOUCI_API}/generate_payment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.publicKey}:${settings.privateKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: String(input.amountMillimes),
      developer_tracking_id: input.trackingId,
      accept_card: true,
      success_link: input.successUrl,
      fail_link: input.failUrl,
      webhook: input.webhookUrl,
      webhook_version: 2,
      session_timeout_secs: 1200,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
}

export async function flouciVerifyPayment(settings: FlouciSettings, paymentId: string): Promise<Response> {
  return fetch(`${FLOUCI_API}/verify_payment/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${settings.publicKey}:${settings.privateKey}` },
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
}

export type FlouciHistoryMatch = { status: string | null; amountMillimes: number | null; type: string | null; createdAt: string | null };

/** Search documented online transaction history by the merchant tracking ID. The API has no tracking-ID filter,
 * so this scans a bounded date window and returns only non-PII fields. It never uses undocumented response keys. */
export async function flouciSearchHistoryByTrackingId(settings: FlouciSettings, trackingId: string, createdAt: string) {
  const start = new Date(new Date(createdAt).getTime() - 120_000);
  if (!Number.isFinite(start.getTime()) || !/^[0-9a-f-]{36}$/i.test(trackingId)) {
    return { ok: false as const, matches: [] as FlouciHistoryMatch[], truncated: false };
  }
  const matches: FlouciHistoryMatch[] = [];
  const maximumPages = 3;
  for (let page = 1; page <= maximumPages; page += 1) {
    const endpoint = new URL(`${FLOUCI_API}/history`);
    endpoint.searchParams.set("type", "online");
    endpoint.searchParams.set("start_date", start.toISOString());
    endpoint.searchParams.set("end_date", new Date().toISOString());
    endpoint.searchParams.set("page_size", "100");
    endpoint.searchParams.set("page", String(page));
    let response: Response;
    try {
      response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${settings.publicKey}:${settings.privateKey}` },
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      });
    } catch { return { ok: false as const, matches: [] as FlouciHistoryMatch[], truncated: false }; }
    if (!response.ok) return { ok: false as const, matches: [] as FlouciHistoryMatch[], truncated: false };
    const body = await response.json().catch(() => null) as { success?: boolean; count?: number; results?: unknown } | null;
    if (!body || body.success !== true || !Array.isArray(body.results)) {
      return { ok: false as const, matches: [] as FlouciHistoryMatch[], truncated: false };
    }
    for (const raw of body.results) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as { developer_tracking_id?: unknown; status?: unknown; amount?: unknown; type?: unknown; created_at?: unknown };
      if (row.developer_tracking_id !== trackingId) continue;
      const amount = typeof row.amount === "number" ? row.amount :
        typeof row.amount === "string" && /^\d+$/.test(row.amount) ? Number(row.amount) : null;
      matches.push({
        status: typeof row.status === "string" ? row.status : null,
        amountMillimes: Number.isSafeInteger(amount) ? amount : null,
        type: typeof row.type === "string" ? row.type : null,
        createdAt: typeof row.created_at === "string" ? row.created_at : null,
      });
    }
    const hasNext = typeof body.count === "number" ? page * 100 < body.count : body.results.length === 100;
    if (!hasNext) return { ok: true as const, matches, truncated: false };
  }
  return { ok: true as const, matches, truncated: true };
}

export async function paymentRpc<T>(name: string, input: Record<string, unknown>): Promise<T> {
  const response = await adminRest(`rpc/${name}`, { method: "POST", body: JSON.stringify(input) });
  if (!response.ok) {
    const failure = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(failure?.message ?? "PAYMENT_DATABASE_ERROR");
  }
  return response.json() as Promise<T>;
}

export async function failFlouciInitialization(trackingId: string): Promise<boolean> {
  return paymentRpc<boolean>("fail_flouci_initialization", { p_tracking_id: trackingId });
}

export function validHostedPaymentUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "checkout.flouci.com" && !url.username && !url.password;
  } catch {
    return false;
  }
}
