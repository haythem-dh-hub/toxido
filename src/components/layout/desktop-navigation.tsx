import Link from "next/link";
import { primaryNavigation } from "@/components/layout/navigation-data";

export function DesktopNavigation() {
  return (
    <nav className="hidden min-w-0 lg:block" aria-label="Primary navigation">
      <ul className="flex items-center gap-3 xl:gap-7">
        {primaryNavigation.map((item) => (
          <li key={item.href} className="shrink-0">
            <Link
              className="nav-link whitespace-nowrap text-[0.625rem] font-semibold uppercase tracking-[0.09em] text-silver-bright/90 hover:text-gold focus-visible:text-gold xl:tracking-[0.17em]"
              href={item.href}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
