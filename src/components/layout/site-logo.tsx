import Image from "next/image";
import Link from "next/link";

type SiteLogoProps = {
  className?: string;
  onClick?: () => void;
};

export function SiteLogo({ className, onClick }: SiteLogoProps) {
  return (
    <Link
      href="/"
      onClick={onClick}
      className={`group inline-flex shrink-0 items-center gap-2 sm:gap-2.5 lg:gap-3 ${className ?? ""}`}
      aria-label="TOXIDO home"
    >
      {/* Circular Gold Emblem */}
      <span
        className="relative flex h-9 w-9 shrink-0 aspect-square items-center justify-center overflow-hidden rounded-full border border-gold-muted/45 bg-ink transition-transform duration-300 group-hover:scale-105 sm:h-11 sm:w-11 lg:h-12 lg:w-12"
        style={{ aspectRatio: "1 / 1", borderRadius: "50%" }}
      >
        <Image
          src="/images/campaign/logo-emblem.png"
          alt="TOXIDO Emblem"
          fill
          sizes="(min-width: 1024px) 48px, (min-width: 640px) 44px, 36px"
          className="object-contain object-center"
          priority
        />
      </span>

      {/* Brand Wordmark */}
      <span className="flex flex-col justify-center">
        <span
          className="whitespace-nowrap text-[0.9375rem] font-bold leading-none tracking-[0.17em] text-ivory sm:text-lg sm:tracking-[0.23em] lg:text-xl lg:tracking-[0.25em]"
          style={{ fontFamily: "var(--font-display), Georgia, serif" }}
        >
          TOXIDO
        </span>
        <span className="mt-1 whitespace-nowrap text-[0.5rem] uppercase leading-none tracking-[0.18em] text-gold opacity-90 sm:text-[0.5625rem] sm:tracking-[0.2em] lg:text-[0.6rem]">
          Fragrance
        </span>
      </span>
    </Link>
  );
}
