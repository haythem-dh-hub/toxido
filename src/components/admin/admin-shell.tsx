"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products" },
];

export function AdminShell({ children, email }: { children: React.ReactNode; email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  async function signOut() {
    await fetch("/api/admin/session", { method: "DELETE" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <section className="min-h-[80vh] bg-ink text-ivory">
      <div className="site-container grid gap-8 py-8 lg:grid-cols-[230px_1fr] lg:py-12">
        <aside className="h-fit border border-gold-muted/40 bg-charcoal p-5 lg:sticky lg:top-6">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-gold">Toxido control</p>
          <p className="mt-2 truncate text-xs text-muted" title={email}>{email}</p>
          <nav aria-label="Admin navigation" className="mt-7 grid gap-2">
            {links.map((link) => {
              const active = link.href === "/admin" ? pathname === link.href : pathname.startsWith(link.href);
              return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}
                className={`border px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${active ? "border-gold bg-gold/10 text-gold" : "border-transparent text-silver-bright hover:border-smoke hover:text-ivory"}`}>
                {link.label}
              </Link>;
            })}
          </nav>
          <button type="button" onClick={signOut} className="mt-7 min-h-11 w-full border border-smoke px-4 text-xs uppercase tracking-wider text-silver-bright hover:border-gold-muted hover:text-gold">Sign out</button>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </section>
  );
}
