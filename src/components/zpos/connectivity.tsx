import { useEffect, useState } from "react";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type State = "online" | "syncing" | "offline";

export function ConnectivityBadge({ className }: { className?: string }) {
  const [state, setState] = useState<State>("online");

  useEffect(() => {
    const set = () => setState(navigator.onLine ? "online" : "offline");
    set();
    window.addEventListener("online", set);
    window.addEventListener("offline", set);
    return () => {
      window.removeEventListener("online", set);
      window.removeEventListener("offline", set);
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
      label: "Syncing…",
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
      <cfg.Icon className="h-3 w-3 opacity-70" />
      <span>{cfg.label}</span>
    </div>
  );
}
