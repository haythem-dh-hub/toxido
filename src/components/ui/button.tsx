import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "luxury-outline";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const styles: Record<ButtonVariant, string> = {
  primary: "border border-silver-bright bg-ivory text-ink hover:border-ivory hover:bg-silver-bright",
  secondary: "border border-graphite bg-graphite text-ivory hover:border-smoke hover:bg-smoke",
  ghost: "border border-transparent bg-transparent text-ivory hover:bg-graphite",
  "luxury-outline": "border border-gold-muted bg-transparent text-gold hover:border-gold hover:bg-gold hover:text-ink",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, type = "button", variant = "primary", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center px-5 text-[0.6875rem] font-bold uppercase tracking-[0.16em] transition-colors duration-300 disabled:opacity-45",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
});
