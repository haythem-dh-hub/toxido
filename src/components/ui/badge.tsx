import { cn } from "@/lib/cn";

type BadgeTone = "neutral" | "silver" | "gold";

const styles: Record<BadgeTone, string> = {
  neutral: "border-smoke text-muted",
  silver: "border-silver/40 text-silver-bright",
  gold: "border-gold-muted text-gold",
};

export function Badge({ children, className, tone = "neutral" }: React.PropsWithChildren<{ className?: string; tone?: BadgeTone }>) {
  return <span className={cn("inline-flex border px-2 py-1 text-[0.625rem] font-bold uppercase tracking-[0.15em]", styles[tone], className)}>{children}</span>;
}
