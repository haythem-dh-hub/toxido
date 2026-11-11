import { BadgeCheck, Gem, PackageCheck, Sparkles } from "lucide-react";
import { Reveal } from "@/components/home/reveal";
import { toxidoPrinciples } from "@/features/products/mock-home-data";

const icons = [Gem, Sparkles, BadgeCheck, PackageCheck];

export function WhyToxido() {
  return (
    <section className="section-space page-gutter border-y border-smoke bg-charcoal"><div className="site-container"><p className="type-eyebrow">The standard</p><h2 className="type-heading mt-4 text-ivory">Why TOXIDO.</h2><div className="mt-12 grid gap-px bg-smoke sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">{toxidoPrinciples.map((principle, index) => { const Icon = icons[index]; return <Reveal key={principle.title} delay={index * 0.05}><article className="min-h-full bg-charcoal p-6 sm:p-7"><Icon aria-hidden="true" className="text-gold" size={22} strokeWidth={1.35} /><h3 className="type-title mt-8 text-ivory">{principle.title}</h3><p className="type-body-muted mt-4">{principle.description}</p></article></Reveal>; })}</div></div></section>
  );
}
