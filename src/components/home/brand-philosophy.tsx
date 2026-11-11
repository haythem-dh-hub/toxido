import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CampaignImage } from "@/components/home/campaign-image";
import { Reveal } from "@/components/home/reveal";

const philosophyImage = "/images/campaign/accessories-placeholder.png";

export function BrandPhilosophy() {
  return (
    <section id="philosophy" className="section-space page-gutter bg-ink">
      <div className="site-container grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <Reveal className="order-2 lg:order-1">
          <div>
            <p className="type-eyebrow">The Toxido philosophy</p>
            <h2 className="type-heading mt-5 max-w-xl text-ivory">More than a fragrance.</h2>
            <div className="mt-7 max-w-lg space-y-5 text-sm leading-7 text-muted sm:text-base">
              <p>TOXIDO is for the man who understands that presence is felt before it is explained. A measured note, a considered detail, a quiet certainty.</p>
              <p>Confidence without arrogance. Elegance without noise. Mystery without explanation. The pieces you choose become part of how the world remembers you.</p>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/fragrances" className="inline-flex items-center gap-2 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-silver-bright transition-colors hover:text-gold">
                Discover the collection <ArrowRight aria-hidden="true" size={16} />
              </Link>
              <span className="hidden h-px w-12 bg-gold-muted sm:block" aria-hidden="true" />
              <span className="text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-muted">Presence / Ritual / Objects</span>
            </div>
          </div>
        </Reveal>
        <Reveal delay={0.1} className="order-1 lg:order-2">
          <CampaignImage src={philosophyImage} alt="Abstract tailored lifestyle placeholder" className="aspect-[4/5]" sizes="(max-width: 1024px) 100vw, 55vw" />
        </Reveal>
      </div>
    </section>
  );
}
