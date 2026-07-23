import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "gold" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const sizes: Record<Size, string> = {
  sm: "h-9 px-5 text-xs clip-cut-sm",
  md: "h-11 px-8 text-sm clip-cut",
  lg: "h-14 px-10 text-base clip-cut",
};

export const GoldButton = forwardRef<HTMLButtonElement, Props>(function GoldButton(
  { className, variant = "gold", size = "md", children, ...rest },
  ref,
) {
  const base =
    "inline-flex items-center justify-center gap-2 font-display font-bold uppercase tracking-widest transition-all disabled:opacity-50 disabled:pointer-events-none select-none";
  const variants: Record<Variant, string> = {
    gold: "bg-gold-gradient text-black hover:brightness-110 active:brightness-95 shadow-[0_8px_24px_-10px_var(--gold)]",
    outline:
      "bg-transparent text-gold border border-[color:var(--gold)]/60 hover:bg-[color:var(--gold)]/10",
    ghost: "bg-white/5 text-gold hover:bg-white/10",
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
