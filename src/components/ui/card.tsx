import { cn } from "@/lib/cn";

export function Card({ children, className }: React.PropsWithChildren<{ className?: string }>) {
  return <section className={cn("border border-smoke bg-charcoal shadow-[var(--toxido-shadow-raised)]", className)}>{children}</section>;
}
