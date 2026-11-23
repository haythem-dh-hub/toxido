"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/features/cart/use-cart";

const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_ATTEMPTS = 15;

export function PendingPaymentPoller({ reference }: { reference: string }) {
  const router = useRouter();
  const { items, removeItem } = useCart();
  const [attempt, setAttempt] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    let timer: NodeJS.Timeout;

    async function poll() {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(reference)}/status`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json().catch(() => null)) as { payment_status?: string } | null;
        const status = data?.payment_status;

        if (status && status !== "pending") {
          activeRef.current = false;
          if (status === "paid") {
            for (const item of items) {
              removeItem(item.productSlug, item.variantId);
            }
          }
          router.refresh();
          return;
        }
      } catch {
        // Transient network error during poll; continue until max attempts
      }

      setAttempt((current) => {
        const next = current + 1;
        if (next >= MAX_POLL_ATTEMPTS) {
          activeRef.current = false;
          setTimedOut(true);
          return next;
        }
        if (activeRef.current) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
        return next;
      });
    }

    timer = setTimeout(poll, POLL_INTERVAL_MS);

    return () => {
      activeRef.current = false;
      clearTimeout(timer);
    };
  }, [reference, items, removeItem, router]);

  if (timedOut) {
    return (
      <div className="mt-4 border border-gold-muted/40 bg-ink/60 p-4 text-xs text-muted">
        Payment confirmation is taking longer than usual. If you already completed payment, please refresh this page or contact us on WhatsApp with your reference.
      </div>
    );
  }

  return (
    <div className="mt-4 flex items-center justify-center gap-3 border border-gold-muted/30 bg-ink/40 px-4 py-3 text-xs text-gold">
      <span className="inline-block h-2 w-2 animate-ping rounded-full bg-gold" />
      <span>Confirming card payment with Flouci… (attempt {attempt + 1} of {MAX_POLL_ATTEMPTS})</span>
    </div>
  );
}
