import Link from "next/link";
import { primaryNavigation } from "@/components/layout/navigation-data";

export function DesktopNavigation() {
  return (
    <nav className="hidden lg:block" aria-label="Primary navigation">
      <ul className="flex items-center gap-7 xl:gap-9">
        {primaryNavigation.map((item) => (
          <li key={item.href}>
            <Link className="nav-link text-[0.6875rem] font-bold uppercase tracking-[0.15em] text-silver transition-colors duration-300 hover:text-gold" href={item.href}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
