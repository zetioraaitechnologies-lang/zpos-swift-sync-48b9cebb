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
          <div className="eyebrow text-muted-foreground">{label}</div>
          <div
            className={cn(
              "mt-2 font-display text-3xl font-bold tracking-tight",
              accent ? "text-gold" : "text-foreground",
            )}
          >
            {value}
          </div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        <div
          className={cn(
            "grid h-11 w-11 place-items-center clip-cut-sm",
            accent ? "bg-gold-gradient" : "bg-navy",
          )}
        >
          <Icon className={cn("h-5 w-5", accent ? "text-on-accent" : "text-gold")} />
        </div>
      </div>
    </div>

  );
}
