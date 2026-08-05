import { useEffect, useState } from "react";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { isOnline, pendingCount, subscribeSyncStatus } from "@/lib/zpos-offline";

type State = "online" | "syncing" | "offline";

export function ConnectivityBadge({ className }: { className?: string }) {
  const [state, setState] = useState<State>(isOnline() ? "online" : "offline");
  const [pending, setPending] = useState(pendingCount());

  useEffect(() => {
    const setNet = () => setState(isOnline() ? (pendingCount() > 0 ? "syncing" : "online") : "offline");
    setNet();
    window.addEventListener("online", setNet);
    window.addEventListener("offline", setNet);
    const unsub = subscribeSyncStatus((s) => {
      setPending(s.pending);
      if (s.running) setState("syncing");
      else setState(isOnline() ? (s.pending > 0 ? "syncing" : "online") : "offline");
    });
    return () => {
      window.removeEventListener("online", setNet);
      window.removeEventListener("offline", setNet);
      unsub();
    };
  }, []);

  const cfg = {
    online: {
      label: "Online",
      Icon: Wifi,
      dot: "bg-emerald-400",
      ring: "border-emerald-400/40",
    },
    syncing: {
      label: pending > 0 ? `Syncing ${pending}` : "Syncing…",
      Icon: RefreshCw,
      dot: "bg-amber-300",
      ring: "border-amber-300/40",
    },
    offline: {
      label: "Offline",
      Icon: WifiOff,
      dot: "bg-red-400",
      ring: "border-red-400/40",
    },
  }[state];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 clip-cut-sm border bg-input px-3 py-1 text-xs font-semibold uppercase tracking-wider",
        cfg.ring,
        className,
      )}
      title={
        state === "offline"
          ? "Offline Mode — Your data is safely stored on this device and will automatically synchronize when an internet connection becomes available."
          : cfg.label
      }
    >
      <span className={cn("h-2 w-2 rounded-full", cfg.dot)} />
      <cfg.Icon className={cn("h-3 w-3 opacity-70", state === "syncing" && "animate-spin")} />
      <span>{cfg.label}</span>
    </div>
  );
}
