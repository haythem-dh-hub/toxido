import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CampaignImage } from "@/components/home/campaign-image";
import { Reveal } from "@/components/home/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { featuredCollections } from "@/features/products/mock-home-data";

export function FeaturedCollections() {
  return (
    <section id="collections" className="section-space page-gutter bg-ink">
      <div className="site-container">
        <SectionHeading eyebrow="The Toxido edit" title="Made for the way you arrive." description="A precise selection of fragrance and modern essentials, chosen for presence rather than excess." />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16">
          {featuredCollections.map((collection, index) => (
            <Reveal key={collection.title} delay={index * 0.05}>
              <Link href={collection.href} className="group relative block overflow-hidden border border-smoke bg-charcoal">
                <CampaignImage src={collection.image} alt={collection.alt} sizes="(max-width: 640px) 100vw, 50vw" className="aspect-[4/5] sm:aspect-[5/4]" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 sm:p-7">
                  <div><p className="type-eyebrow text-silver-bright">{collection.eyebrow}</p><h3 className="type-title mt-2 text-ivory">{collection.title}</h3></div>
                  <ArrowUpRight aria-hidden="true" className="mb-1 shrink-0 text-silver-bright transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1" size={21} strokeWidth={1.4} />
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
