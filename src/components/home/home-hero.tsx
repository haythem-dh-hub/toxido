import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CinematicHeroBackground } from "@/components/home/cinematic-hero-background";
import { homeHero } from "@/features/products/mock-home-data";

export function HomeHero() {
  return (
    <section className="relative isolate min-h-[calc(100svh-8rem)] overflow-hidden border-b border-smoke bg-ink sm:min-h-[calc(100svh-8.5rem)]">
      <CinematicHeroBackground src={homeHero.image} alt={homeHero.alt} />
      <div className="page-gutter relative z-10 flex min-h-[calc(100svh-8rem)] items-end pb-14 pt-28 sm:min-h-[calc(100svh-8.5rem)] sm:pb-20 lg:pb-24">
        <div className="site-container w-full">
          <div className="max-w-3xl animate-hero-copy">
            <p className="type-eyebrow mb-5 text-silver-bright">TOXIDO · EST. 2026</p>
            <h1 className="type-display max-w-3xl text-ivory">Define your presence.</h1>
            <p className="mt-7 max-w-md text-sm leading-7 text-silver-bright sm:text-base">Fragrance and accessories for the modern gentleman.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/fragrances" className="inline-flex min-h-11 items-center justify-center gap-2 border border-silver-bright bg-ivory px-5 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-ink transition-colors duration-300 hover:border-ivory hover:bg-silver-bright">Shop Fragrances <ArrowRight aria-hidden="true" size={16} /></Link>
              <Link href="#collections" className="inline-flex min-h-11 items-center justify-center border border-gold-muted px-5 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-gold transition-colors duration-300 hover:border-gold hover:bg-gold hover:text-ink">Explore Collection</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
