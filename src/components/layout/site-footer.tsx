import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { footerNavigation } from "@/components/layout/navigation-data";

const socialLinks = [
  { href: "https://instagram.com", label: "Instagram" },
  { href: "https://tiktok.com", label: "TikTok" },
  { href: "https://linkedin.com", label: "LinkedIn" },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-smoke bg-charcoal">
      <div className="page-gutter">
        <div className="site-container py-14 sm:py-18 lg:py-20">
          <div className="grid gap-12 border-b border-smoke pb-12 lg:grid-cols-[1.1fr_1.9fr] lg:gap-20">
            <section aria-labelledby="newsletter-title" className="max-w-md">
              <p className="type-eyebrow">Private access</p>
              <h2 id="newsletter-title" className="type-title mt-3 text-ivory">A more considered ritual.</h2>
              <p className="type-body-muted mt-4">Private releases, fragrance intelligence, and refined essentials—delivered sparingly.</p>
              <p className="mt-5 text-sm text-muted">Newsletter sign-up is coming soon.</p>
            </section>
            <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3">
              {Object.entries(footerNavigation).map(([heading, links]) => (
                <section key={heading} aria-labelledby={`${heading.toLowerCase().replaceAll(" ", "-")}-footer`}>
                  <h2 id={`${heading.toLowerCase().replaceAll(" ", "-")}-footer`} className="type-eyebrow">{heading}</h2>
                  <ul className="mt-5 space-y-3">
                    {links.map((link) => (
                      <li key={link.href}><Link href={link.href} className="text-sm text-muted transition-colors hover:text-ivory">{link.label}</Link></li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-7 pt-7 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-lg font-semibold tracking-[0.2em] text-ivory" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>TOXIDO</p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              {socialLinks.map(({ href, label }) => (
                <a key={label} href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-silver transition-colors hover:text-ivory">
                  {label}<ArrowUpRight aria-hidden="true" size={13} strokeWidth={1.5} />
                </a>
              ))}
            </div>
            <p className="text-xs text-muted">© {new Date().getFullYear()} TOXIDO.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
