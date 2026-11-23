import { NextResponse } from "next/server";
import { getSupabaseSettings } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type PublicOrderStatus = {
  reference: string;
  status: string;
  payment_method: string;
  payment_status: string;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;
  if (!/^TX-\d{8}-[A-F0-9]{32}$/.test(reference)) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const settings = getSupabaseSettings();
  if (!settings) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  try {
    const response = await fetch(new URL("/rest/v1/rpc/get_public_order", settings.url), {
      method: "POST",
      headers: {
        apikey: settings.anonKey,
        Authorization: `Bearer ${settings.anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_reference: reference }),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const order = (await response.json().catch(() => null)) as PublicOrderStatus | null;
    if (!order || order.reference !== reference) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    return NextResponse.json(
      {
        reference: order.reference,
        payment_status: order.payment_status,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return NextResponse.json({ error: "Order status check failed." }, { status: 503 });
  }
}
