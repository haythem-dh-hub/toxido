'use client';

import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Reveal } from "@/components/home/reveal";
import { subscribeToNewsletter } from "@/services/newsletter-service";

export function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setMessage("Enter a valid email address.");
      return;
    }

    const response = await subscribeToNewsletter(trimmedEmail);
    setMessage(response.error?.message ?? "Newsletter sign-up is unavailable.");
  }

  return (
    <section className="page-gutter bg-ink py-20 sm:py-28">
      <Reveal className="site-container mx-auto max-w-3xl text-center">
        <p className="type-eyebrow">The private list</p>
        <h2 className="type-heading mt-5 text-ivory">Enter the inner circle.</h2>
        <p className="type-body-muted mx-auto mt-5 max-w-lg">New releases, considered recommendations, and rare finds. Nothing unnecessary.</p>
        <form className="mx-auto mt-8 flex max-w-xl flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="home-newsletter-email">Email address</label>
          <Input id="home-newsletter-email" type="email" autoComplete="email" placeholder="Your email address" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <button type="submit" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 border border-silver-bright bg-ivory px-5 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-ink transition-colors hover:bg-silver-bright">
            Join the list <ArrowRight aria-hidden="true" size={16} />
          </button>
        </form>
        {message ? <p role="status" className="mt-4 text-sm text-silver-bright">{message}</p> : null}
      </Reveal>
    </section>
  );
}
