import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function ActionLink({ href, label, icon: Icon, detail }: { href: string; label: string; icon: LucideIcon; detail?: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex min-h-11 items-center justify-center gap-2 text-silver transition-all duration-300 hover:-translate-y-0.5 hover:text-gold focus-visible:outline-none"
      aria-label={label}
    >
      <Icon aria-hidden="true" size={18} strokeWidth={1.45} className="transition-transform duration-300 group-hover:scale-110" />
      {detail ? <span className="hidden text-[0.625rem] font-bold uppercase tracking-[0.14em] xl:inline">{detail}</span> : null}
    </Link>
  );
}
