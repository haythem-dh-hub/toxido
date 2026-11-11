// import Link from "next/link";

// export function SiteLogo({ className }: { className?: string }) {
//   return (
//     <Link href="/" className={className} aria-label="TOXIDO home">
//       <span className="text-xl font-semibold tracking-[0.26em] text-ivory sm:text-2xl" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>TOXIDO</span>
//     </Link>
//   );
// }
import Link from "next/link";
import Image from "next/image";

export function SiteLogo({ className }: { className?: string }) {
  return (
    <Link 
      href="/" 
      className={`inline-flex items-center gap-3 group ${className ?? ""}`} 
      aria-label="TOXIDO home"
    >
      {/* Gold Emblem Image */}
<div className="relative h-12 w-12 sm:h-14 sm:w-14 transition-transform duration-300 group-hover:scale-105">
        <Image
          src="/images/campaign/logo-emblem.png"
          alt="TOXIDO Emblem"
          fill
          className="object-contain"
          priority
        />
      </div>
      
      {/* Clean Brand Typography */}
      <div className="flex flex-col">
        <span 
          className="text-xl font-bold tracking-[0.25em] text-ivory leading-none" 
          style={{ fontFamily: "var(--font-display), Georgia, serif" }}
        >
          TOXIDO
        </span>
        <span className="text-[0.6rem] tracking-[0.2em] text-gold uppercase mt-1 opacity-90">
          Fragrance
        </span>
      </div>
    </Link>
  );
}