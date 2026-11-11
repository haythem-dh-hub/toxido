import { cn } from "@/lib/cn";

export interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
}

export function SectionHeading({ eyebrow, title, description, align = "left", className }: SectionHeadingProps) {
  return (
    <header className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? <p className="type-eyebrow mb-4">{eyebrow}</p> : null}
      <h2 className="type-heading text-ivory">{title}</h2>
      {description ? <p className="type-body-muted mt-5 max-w-xl">{description}</p> : null}
    </header>
  );
}
