import Image from "next/image";
import { cn } from "@/lib/cn";

export function CampaignImage({ src, alt, className, priority = false, sizes = "(max-width: 768px) 100vw, 50vw" }: { src: string; alt: string; className?: string; priority?: boolean; sizes?: string }) {
  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-graphite", className)}>
      <Image src={src} alt={alt} fill priority={priority} sizes={sizes} unoptimized={src.toLowerCase().endsWith(".svg")} className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.035]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
    </div>
  );
} 
