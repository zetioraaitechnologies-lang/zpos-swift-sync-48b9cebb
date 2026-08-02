import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "gold" | "navy" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const sizes: Record<Size, string> = {
  sm: "h-9 px-5 text-[11px] clip-cut-sm",
  md: "h-11 px-8 text-xs clip-cut-sm",
  lg: "h-14 px-10 text-sm clip-cut",
};

export const GoldButton = forwardRef<HTMLButtonElement, Props>(function GoldButton(
  { className, variant = "gold", size = "md", children, ...rest },
  ref,
) {
  const base =
    "inline-flex items-center justify-center gap-2 font-display font-semibold uppercase tracking-[0.18em] transition-all disabled:opacity-50 disabled:pointer-events-none select-none";
  const variants: Record<Variant, string> = {
    gold: "bg-gold-gradient text-on-accent hover:brightness-105 active:brightness-95",
    navy: "bg-navy text-primary-foreground hover:bg-navy-deep",
    outline:
      "bg-transparent text-navy border-2 border-[color:var(--navy)] hover:bg-[color:var(--navy)] hover:text-[color:var(--primary-foreground)]",
    ghost: "bg-secondary text-navy hover:bg-accent",
  };

  return (
    <button
      ref={ref}
      className={cn(base, sizes[size], variants[variant], className)}
      {...rest}
    >
      {children}
    </button>
  );
});
