import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CampaignImage } from "@/components/home/campaign-image";
import { Reveal } from "@/components/home/reveal";
import { accessoriesShowcase } from "@/features/products/mock-home-data";

export function AccessoriesShowcase() {
  return (
    <section className="section-space page-gutter bg-ink">
      <div className="site-container"><div className="mb-12 flex flex-col gap-4 sm:mb-16 sm:flex-row sm:items-end sm:justify-between"><div><p className="type-eyebrow">The essentials</p><h2 className="type-heading mt-4 text-ivory">Objects of intention.</h2></div><Link href="/accessories" className="text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-silver transition-colors hover:text-ivory">Explore accessories</Link></div>
        <div className="grid gap-4 lg:grid-cols-2">
          {accessoriesShowcase.map((item, index) => <Reveal key={item.title} delay={index * 0.08}><Link href={item.href} className="group relative block overflow-hidden border border-smoke"><CampaignImage src={item.image} alt={item.alt} className="aspect-[4/5] sm:aspect-[16/11]" sizes="(max-width: 1024px) 100vw, 50vw" /><div className="absolute inset-x-0 bottom-0 p-6 sm:p-8"><h3 className="type-title text-ivory">{item.title}</h3><p className="mt-3 max-w-sm text-sm leading-6 text-silver-bright">{item.description}</p><ArrowUpRight aria-hidden="true" className="mt-5 text-silver-bright transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1" size={20} /></div></Link></Reveal>)}
        </div>
      </div>
    </section>
  );
}
