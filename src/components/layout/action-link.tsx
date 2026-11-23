import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function ActionLink({ href, label, icon: Icon, detail, count }: { href: string; label: string; icon: LucideIcon; detail?: string; count?: number }) {
  return (
    <Link
      href={href}
      className="group relative inline-flex min-h-11 min-w-10 items-center justify-center gap-2 text-silver transition-colors duration-250 hover:text-gold focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold"
      aria-label={label}
    >
      <Icon aria-hidden="true" size={18} strokeWidth={1.4} className="transition-[color,transform] duration-250 group-hover:scale-105 group-hover:text-gold" />
      {count !== undefined && count > 0 ? <span aria-hidden="true" className="absolute right-0 top-1 grid min-h-4 min-w-4 -translate-y-0.5 translate-x-1/3 place-items-center rounded-full border border-ink bg-gold px-1 text-[0.5625rem] font-bold leading-none text-ink">{count > 99 ? "99+" : count}</span> : null}
      {detail ? <span className="hidden text-[0.625rem] font-bold uppercase tracking-[0.14em] xl:inline">{detail}</span> : null}
    </Link>
  );
}
