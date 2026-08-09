import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Store } from "lucide-react";
import { useAuth } from "@/lib/zpos-auth";
import { getMode } from "@/lib/business-modes";

/**
 * Multi-store switcher. Shows every organization the signed-in user belongs to
 * (owner of several shops, or a cashier assigned to more than one branch) and
 * swaps the active store for the whole app.
 */
export function StoreSwitcher() {
  const { org, orgs, switchOrg } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!org) return null;
  const single = orgs.length <= 1;

  const pick = async (id: string) => {
    if (id === org.id) return setOpen(false);
    setBusy(true);
    try {
      await switchOrg(id);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => !single && setOpen((v) => !v)}
        disabled={single || busy}
        className="flex max-w-[220px] items-center gap-2 border border-border bg-secondary/60 px-3 py-1.5 text-left text-xs transition-colors hover:bg-secondary disabled:cursor-default"
        aria-label="Switch store"
      >
        <Store className="h-3.5 w-3.5 shrink-0 text-gold" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[11px] font-bold uppercase tracking-widest">
            {org.businessName}
          </span>
          <span className="block truncate text-[10px] uppercase tracking-widest text-muted-foreground">
            {getMode(org.businessType).label}
          </span>
        </span>
        {!single && <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-64 border border-border bg-card p-1 shadow-xl">
          <div className="px-2 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            Your stores ({orgs.length})
          </div>
          {orgs.map((o) => (
            <button
              key={o.id}
              onClick={() => void pick(o.id)}
              className="flex w-full items-center gap-2 px-2 py-2 text-left text-xs hover:bg-secondary"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{o.name}</span>
                <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">
                  {o.role} · {getMode(o.businessType).label}
                </span>
              </span>
              {o.id === org.id && <Check className="h-3.5 w-3.5 text-gold" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
