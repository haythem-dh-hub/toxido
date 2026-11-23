"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CampaignImage } from "@/components/home/campaign-image";
import { useCart } from "@/features/cart/use-cart";
import { formatMoney } from "@/lib/format-money";
import { submitOrder } from "@/services/checkout-service";
import { CatalogDataNotice } from "@/components/product/catalog-data-notice";
import { buildCheckoutItems, cartItemKey, resolveCartLines } from "@/features/cart/cart-utils";
import { cartLineTotal } from "@/features/products/variant-pricing";
import { startFlouciPayment } from "@/services/checkout-service";
import { calculateDomesticOrderTotalMillimes, DOMESTIC_DELIVERY_FEE_MILLIMES, TUNISIAN_GOVERNORATES } from "@/features/checkout/tunisia-delivery";

export default function CheckoutPage() {
  const { items, removeItem, products, catalogIsDemo } = useCart();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash_on_delivery" | "flouci">("cash_on_delivery");
  const idempotencyKey = useRef<string | null>(null);
  const lines = resolveCartLines(items, products);
  const orderItems = buildCheckoutItems(lines);
  const tndOnly = lines.every(({ variant }) => variant?.price.currency === "TND");
  const subtotalMillimes = lines.reduce((total, line) => total +
    (line.variant?.price.currency === "TND" ? Math.round(line.variant.price.amount * 1000) * line.item.quantity : 0), 0);
  const estimatedTotalMillimes = tndOnly ? calculateDomesticOrderTotalMillimes(subtotalMillimes) : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || !orderItems) return;
    const values = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setMessage("");
    idempotencyKey.current ??= crypto.randomUUID();
    try {
      const submission = {
        idempotencyKey: idempotencyKey.current,
        customer: {
          fullName: String(values.get("fullName") ?? "").trim(),
          email: String(values.get("email") ?? "").trim(),
          phone: String(values.get("phone") ?? "").trim(),
          address: String(values.get("address") ?? "").trim(),
          city: String(values.get("city") ?? "").trim(),
          governorate: String(values.get("governorate") ?? "").trim(),
        },
        items: orderItems,
      };
      const result = paymentMethod === "flouci"
        ? await startFlouciPayment(submission)
        : await submitOrder(submission);
      if (result.error) {
        setMessage(result.error.message);
        if (paymentMethod === "flouci" && ["PAYMENT_INIT_FAILED", "PAYMENT_FAILED", "PAYMENT_EXPIRED"].includes(result.error.code)) idempotencyKey.current = null;
        return;
      }
      if (paymentMethod === "flouci" && "paymentUrl" in result.data && typeof result.data.paymentUrl === "string") {
        window.location.assign(result.data.paymentUrl);
        return;
      }
      lines.forEach(({ item, variant }) => {
        if (variant) removeItem(item.productSlug, variant.id);
      });
      router.push(`/order-confirmation/${encodeURIComponent(result.data.reference)}`);
    } catch {
      setMessage("We could not confirm that your order was saved. Please retry shortly.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="section-space page-gutter bg-ink">
      <div className="site-container">
        <p className="type-eyebrow text-gold">Order details</p>
        <h1 className="type-heading mt-4 text-ivory">Checkout</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">Choose secure card payment through Flouci or Cash on Delivery. Product prices and stock are confirmed against live inventory.</p>

        {lines.length === 0 || !orderItems || !tndOnly ? (
          <div className="mt-10 border border-gold-muted/50 bg-charcoal p-10 text-center">
            <h2 className="type-title text-ivory">{lines.length === 0 ? "Your cart is empty" : !tndOnly ? "Tunisia delivery only" : "A selected size is unavailable"}</h2>
            {lines.length > 0 ? <p className="mt-3 text-sm text-muted">{!tndOnly ? "International shipping is not available yet. Checkout accepts TND-priced products and Tunisian delivery addresses only." : "Update or remove unavailable variants in your cart before continuing."}</p> : null}
            <Link href="/fragrances" className="mt-6 inline-flex min-h-11 items-center border border-gold-muted px-5 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-gold">Explore the collection</Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
            <div>
              <CatalogDataNotice isDemo={catalogIsDemo} />
              <h2 className="type-title text-ivory">Contact and delivery details</h2>
              <form onSubmit={handleSubmit} className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className="text-xs uppercase tracking-wider text-silver-bright">Full name
                  <input name="fullName" autoComplete="name" required className="mt-2 min-h-12 w-full border border-smoke bg-charcoal px-4 text-sm normal-case tracking-normal text-ivory" />
                </label>
                <label className="text-xs uppercase tracking-wider text-silver-bright">Email <span className="text-muted">(optional)</span>
                  <input name="email" type="email" autoComplete="email" className="mt-2 min-h-12 w-full border border-smoke bg-charcoal px-4 text-sm normal-case tracking-normal text-ivory" />
                </label>
                <label className="text-xs uppercase tracking-wider text-silver-bright">Phone <span className="text-muted">(+216)</span>
                  <input name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="XX XXX XXX" required className="mt-2 min-h-12 w-full border border-smoke bg-charcoal px-4 text-sm normal-case tracking-normal text-ivory" />
                </label>
                <label className="text-xs uppercase tracking-wider text-silver-bright sm:col-span-2">Delivery address
                  <input name="address" autoComplete="street-address" required className="mt-2 min-h-12 w-full border border-smoke bg-charcoal px-4 text-sm normal-case tracking-normal text-ivory" />
                </label>
                <label className="text-xs uppercase tracking-wider text-silver-bright">City
                  <input name="city" autoComplete="address-level2" required className="mt-2 min-h-12 w-full border border-smoke bg-charcoal px-4 text-sm normal-case tracking-normal text-ivory" />
                </label>
                <label className="text-xs uppercase tracking-wider text-silver-bright">Governorate
                  <select name="governorate" autoComplete="address-level1" required defaultValue="" className="mt-2 min-h-12 w-full border border-smoke bg-charcoal px-4 text-sm normal-case tracking-normal text-ivory">
                    <option value="" disabled>Select a Tunisian governorate</option>
                    {TUNISIAN_GOVERNORATES.map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </label>
                <fieldset className="grid gap-3 sm:col-span-2">
                  <legend className="text-xs font-bold uppercase tracking-wider text-silver-bright">Payment method</legend>
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 border border-smoke bg-charcoal px-4 text-sm text-ivory has-[:checked]:border-gold">
                    <input type="radio" name="paymentMethod" value="flouci" checked={paymentMethod === "flouci"} onChange={() => setPaymentMethod("flouci")} />
                    <span>Bank card <span className="text-gold">· Flouci</span></span>
                  </label>
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 border border-smoke bg-charcoal px-4 text-sm text-ivory has-[:checked]:border-gold">
                    <input type="radio" name="paymentMethod" value="cash_on_delivery" checked={paymentMethod === "cash_on_delivery"} onChange={() => setPaymentMethod("cash_on_delivery")} />
                    <span>Cash on delivery</span>
                  </label>
                </fieldset>
                <div className="flex flex-col justify-end gap-4 sm:col-span-2">
                  <Button type="submit" disabled={isSubmitting} variant="luxury-outline" className="w-full sm:w-fit">{isSubmitting ? (paymentMethod === "flouci" ? "Preparing secure payment…" : "Saving your order…") : (paymentMethod === "flouci" ? "Continue to Flouci" : "Place Cash on Delivery order")}</Button>
                  {message ? <p role="alert" className="text-sm text-silver-bright">{message}</p> : null}
                </div>
              </form>
            </div>

            <aside className="h-fit border border-gold-muted/50 bg-charcoal p-6 sm:p-7">
              <h2 className="type-eyebrow text-gold">Order summary</h2>
              <ul className="mt-6 space-y-5 border-b border-smoke pb-6">
                {lines.map(({ item, product, variant }) => variant && product ? (
                  <li key={cartItemKey(item)} className="flex items-center gap-4">
                    <div className="w-16 shrink-0"><CampaignImage src={product.images[0]?.url ?? "/images/campaign/hero-placeholder.svg"} alt={product.images[0]?.alt ?? product.name} className="aspect-square" sizes="64px" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ivory">{product.name}</p>
                      <p className="mt-1 text-xs text-muted">Qty {item.quantity} · {variant.size ?? variant.name} · SKU {variant.sku}</p>
                    </div>
                    <p className="shrink-0 text-sm text-ivory">{formatMoney(cartLineTotal(variant.price, item.quantity))}</p>
                  </li>
                ) : null)}
              </ul>
              <dl className="mt-5 space-y-4 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-silver-bright">Product subtotal</dt><dd className="text-right text-ivory">{formatMoney({ amount: subtotalMillimes / 1000, currency: "TND" })}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-silver-bright">Tunisia delivery</dt><dd className="text-right text-ivory">{formatMoney({ amount: DOMESTIC_DELIVERY_FEE_MILLIMES / 1000, currency: "TND" })}</dd></div>
                <div className="flex justify-between gap-4 border-t border-smoke pt-4 font-semibold"><dt className="text-silver-bright">Estimated total</dt><dd className="text-right text-ivory">{estimatedTotalMillimes === null ? "—" : formatMoney({ amount: estimatedTotalMillimes / 1000, currency: "TND" })}</dd></div>
                <div className="flex justify-between gap-4 border-t border-smoke pt-4"><dt className="text-silver-bright">Payment</dt><dd className="text-right text-ivory">{paymentMethod === "flouci" ? "Bank card · Flouci" : "Cash on delivery"}</dd></div>
              </dl>
              <Link href="/cart" className="mt-6 inline-flex text-xs uppercase tracking-wider text-muted hover:text-ivory">Return to cart</Link>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
