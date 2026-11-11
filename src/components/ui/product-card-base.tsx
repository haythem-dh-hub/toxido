import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export interface ProductCardBaseProps {
  image: ReactNode;
  brand: string;
  name: string;
  price: string;
  meta?: string;
  action?: ReactNode;
  className?: string;
  href?: string;
}

export function ProductCardBase({ image, brand, name, price, meta, action, className, href }: ProductCardBaseProps) {
  return (
    <article className={cn("group overflow-hidden border border-gold-muted/45 bg-charcoal shadow-[0_0_0_1px_rgba(184,155,98,0.13)] transition-[border-color,transform,box-shadow] duration-500 hover:border-gold hover:shadow-[0_16px_42px_rgba(184,155,98,0.16)]", className)}>
      {href ? <Link href={href} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">
        <div className="aspect-square overflow-hidden bg-graphite">{image}</div>
        <div className="px-5 pt-5">
          <p className="type-eyebrow text-gold">{brand}</p>
          <h3 className="type-title mt-2 text-ivory">{name}</h3>
          {meta ? <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted">{meta}</p> : null}
          <p className="mt-5 text-sm font-semibold text-silver-bright">{price}</p>
        </div>
      </Link> : <>
        <div className="aspect-square overflow-hidden bg-graphite">{image}</div>
        <div className="p-5">
          <p className="type-eyebrow text-gold">{brand}</p>
          <h3 className="type-title mt-2 text-ivory">{name}</h3>
          {meta ? <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted">{meta}</p> : null}
        </div>
      </>}
      <div className="px-5 pb-5">
        <div className="mt-5 flex items-center justify-between gap-4 border-t border-smoke pt-4">
          {!href ? <p className="text-sm font-semibold text-silver-bright">{price}</p> : <span aria-hidden="true" />}
          {action}
        </div>
      </div>
    </article>
  );
}
