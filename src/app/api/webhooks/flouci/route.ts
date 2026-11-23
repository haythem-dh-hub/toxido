import { verifyFlouciSignature, validateVerifiedFlouciEvent, type FlouciEvent, type FlouciVerification } from "@/features/payments/flouci-security";
import { flouciVerifyPayment, getFlouciSettings, paymentRpc } from "@/lib/flouci-server";
import { readLimitedBody } from "@/lib/read-limited-body";

const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const settings = getFlouciSettings();
  if (!settings) return response({ error: "Webhook is not configured." }, 503);
  const rawBody = await readLimitedBody(request, 16_384);
  if (!rawBody) return response({ error: "Invalid webhook payload." }, 413);
  const signature = request.headers.get("x-flouci-signature");
  if (!verifyFlouciSignature(rawBody, signature, settings.privateKey)) return response({ error: "Invalid webhook signature." }, 401);

  let event: FlouciEvent;
  try { event = JSON.parse(rawBody.toString("utf8")) as FlouciEvent; }
  catch { return response({ error: "Invalid webhook payload." }, 400); }
  if (!event || !["payment.succeeded", "payment.failed"].includes(event.event) ||
      request.headers.get("x-flouci-event") !== event.event ||
      typeof event.event_id !== "string" || event.event_id.length < 1 || event.event_id.length > 200 ||
      typeof event.payment_id !== "string" || event.payment_id.length < 1 || event.payment_id.length > 200 ||
      typeof event.developer_tracking_id !== "string" || !/^[0-9a-f-]{36}$/i.test(event.developer_tracking_id) ||
      !Number.isSafeInteger(event.amount) || typeof event.currency !== "string") {
    return response({ error: "Invalid webhook event." }, 400);
  }

  try {
    if (await paymentRpc<boolean>("flouci_event_is_processed", { p_event_id: event.event_id })) {
      return response({ received: true, duplicate: true });
    }
  } catch {
    return response({ error: "Payment event could not be checked." }, 503);
  }

  let verifiedResponse: Response;
  try { verifiedResponse = await flouciVerifyPayment(settings, event.payment_id); }
  catch { return response({ error: "Payment verification is temporarily unavailable." }, 503); }
  if (!verifiedResponse.ok) return response({ error: "Payment verification is temporarily unavailable." }, 503);
  const verification = await verifiedResponse.json().catch(() => null) as FlouciVerification | null;
  const validated = verification ? validateVerifiedFlouciEvent(event, verification) : null;
  if (!validated) return response({ error: "The verified payment details do not match the event." }, 409);

  try {
    const result = await paymentRpc<{ accepted: boolean; duplicate: boolean; payment_status: string; reconciliation_required?: boolean }>(
      "settle_flouci_payment_event",
      {
        p_event_id: event.event_id,
        p_event_type: event.event,
        p_payment_id: event.payment_id,
        p_tracking_id: event.developer_tracking_id,
        p_amount_millimes: event.amount,
        p_currency: event.currency,
        p_verified_status: validated.status,
      },
    );
    if (!result.accepted) return response({ error: "Payment event was not accepted." }, 409);
    if (result.reconciliation_required) {
      console.error("Flouci reported success for a previously released order; manual payment reconciliation is required.");
    }
    return response({ received: true, duplicate: result.duplicate });
  } catch {
    return response({ error: "Payment event could not be recorded." }, 503);
  }
}
