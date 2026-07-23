import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent?: boolean;
}) {
  return (
    <div className={cn("panel relative overflow-hidden p-5 clip-cut-card")}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {label}
          </div>
          <div
            className={cn(
              "mt-2 font-display text-3xl font-black tracking-tight",
              accent ? "text-gold" : "text-foreground",
            )}
          >
            {value}
          </div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        <div className="grid h-11 w-11 place-items-center bg-gold-gradient clip-cut-sm">
          <Icon className="h-5 w-5 text-black" />
        </div>
      </div>
      <div className="pointer-events-none absolute -bottom-16 -right-16 h-40 w-40 rounded-full bg-[color:var(--gold)]/10 blur-3xl" />
    </div>
  );
}
