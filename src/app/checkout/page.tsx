"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { CampaignImage } from "@/components/home/campaign-image";
import { useCart } from "@/features/cart/use-cart";
import { catalogProducts } from "@/features/products/mock-products";
import { formatMoney } from "@/lib/format-money";
import { submitOrder } from "@/services/checkout-service";

export default function CheckoutPage() {
  const { items } = useCart();
  const [message, setMessage] = useState("");
  const lines = items.flatMap((item) => {
    const product = catalogProducts.find((entry) => entry.slug === item.productSlug);
    const variant = product?.variants[0];
    return product && variant ? [{ item, product, variant }] : [];
  });
  const subtotal = lines.reduce((sum, line) => sum + line.variant.price.amount * line.item.quantity, 0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const result = await submitOrder({
      customer: {
        fullName: String(values.get("fullName") ?? "").trim(),
        email: String(values.get("email") ?? "").trim(),
        phone: String(values.get("phone") ?? "").trim(),
        address: String(values.get("address") ?? "").trim(),
        city: String(values.get("city") ?? "").trim(),
      },
      items,
    });
    if (result.error) setMessage(result.error.message);
  }

  return (
    <section className="section-space page-gutter bg-ink">
      <div className="site-container">
        <p className="type-eyebrow text-gold">Order details</p>
        <h1 className="type-heading mt-4 text-ivory">Checkout</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">Checkout is not connected to an order or payment service. This form does not transmit or save your details, and no order will be placed.</p>

        {lines.length === 0 ? (
          <div className="mt-10 border border-gold-muted/50 bg-charcoal p-10 text-center">
            <h2 className="type-title text-ivory">Your cart is empty</h2>
            <Link href="/fragrances" className="mt-6 inline-flex min-h-11 items-center border border-gold-muted px-5 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-gold">Explore the collection</Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
            <div>
              <h2 className="type-title text-ivory">Contact and delivery details</h2>
              <form onSubmit={handleSubmit} className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className="text-xs uppercase tracking-wider text-silver-bright">Full name
                  <input name="fullName" autoComplete="name" required className="mt-2 min-h-12 w-full border border-smoke bg-charcoal px-4 text-sm normal-case tracking-normal text-ivory" />
                </label>
                <label className="text-xs uppercase tracking-wider text-silver-bright">Email
                  <input name="email" type="email" autoComplete="email" required className="mt-2 min-h-12 w-full border border-smoke bg-charcoal px-4 text-sm normal-case tracking-normal text-ivory" />
                </label>
                <label className="text-xs uppercase tracking-wider text-silver-bright">Phone
                  <input name="phone" type="tel" autoComplete="tel" required className="mt-2 min-h-12 w-full border border-smoke bg-charcoal px-4 text-sm normal-case tracking-normal text-ivory" />
                </label>
                <label className="text-xs uppercase tracking-wider text-silver-bright sm:col-span-2">Delivery address
                  <input name="address" autoComplete="street-address" required className="mt-2 min-h-12 w-full border border-smoke bg-charcoal px-4 text-sm normal-case tracking-normal text-ivory" />
                </label>
                <label className="text-xs uppercase tracking-wider text-silver-bright">City or area
                  <input name="city" autoComplete="address-level2" required className="mt-2 min-h-12 w-full border border-smoke bg-charcoal px-4 text-sm normal-case tracking-normal text-ivory" />
                </label>
                <div className="flex flex-col justify-end gap-4 sm:col-span-2">
                  <Button type="submit" variant="luxury-outline" className="w-full sm:w-fit">Check order service</Button>
                  {message ? <p role="status" className="text-sm text-silver-bright">{message}</p> : null}
                </div>
              </form>
            </div>

            <aside className="h-fit border border-gold-muted/50 bg-charcoal p-6 sm:p-7">
              <h2 className="type-eyebrow text-gold">Order summary</h2>
              <ul className="mt-6 space-y-5 border-b border-smoke pb-6">
                {lines.map(({ item, product, variant }) => (
                  <li key={item.productSlug} className="flex items-center gap-4">
                    <div className="w-16 shrink-0"><CampaignImage src={product.images[0]?.url ?? "/images/campaign/hero-placeholder.svg"} alt={product.images[0]?.alt ?? product.name} className="aspect-square" sizes="64px" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ivory">{product.name}</p>
                      <p className="mt-1 text-xs text-muted">Qty {item.quantity} · {variant.name}</p>
                    </div>
                    <p className="shrink-0 text-sm text-ivory">{formatMoney({ ...variant.price, amount: variant.price.amount * item.quantity })}</p>
                  </li>
                ))}
              </ul>
              <dl className="mt-5 space-y-4 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-silver-bright">Subtotal</dt><dd className="text-ivory">{formatMoney({ amount: subtotal, currency: "NGN" })}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-silver-bright">Delivery</dt><dd className="text-right text-muted">Not configured</dd></div>
                <div className="flex justify-between gap-4 border-t border-smoke pt-4"><dt className="text-silver-bright">Total</dt><dd className="text-right text-muted">Unavailable until checkout is connected</dd></div>
              </dl>
              <Link href="/cart" className="mt-6 inline-flex text-xs uppercase tracking-wider text-muted hover:text-ivory">Return to cart</Link>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
