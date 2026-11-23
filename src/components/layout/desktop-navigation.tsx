import Link from "next/link";
import { primaryNavigation } from "@/components/layout/navigation-data";

export function DesktopNavigation() {
  return (
    <nav className="hidden lg:block" aria-label="Primary navigation">
      <ul className="flex items-center gap-5 xl:gap-8">
        {primaryNavigation.map((item) => (
          <li key={item.href}>
            <Link className="nav-link text-[0.625rem] font-semibold uppercase tracking-[0.17em] text-silver-bright/90 hover:text-gold focus-visible:text-gold" href={item.href}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
