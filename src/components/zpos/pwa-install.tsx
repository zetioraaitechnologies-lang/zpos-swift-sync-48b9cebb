import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "zpos:pwa:dismissed";

export function PwaInstall() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS
      window.navigator.standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }
    if (localStorage.getItem(DISMISS_KEY)) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !evt) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-sm rounded-none-none border border-gold/40 bg-navy p-3 shadow-2xl backdrop-blur">
      <div className="flex items-start gap-3">
        <img src="/icon-192.png" alt="ZPoS" className="h-10 w-10 rounded-none-none" />
        <div className="flex-1">
          <div className="font-display text-sm font-bold uppercase tracking-widest text-gold">
            Install ZPoS
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Add to your home screen for faster, offline access.
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={async () => {
                await evt.prompt();
                const c = await evt.userChoice;
                if (c.outcome === "accepted") setInstalled(true);
                setEvt(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-none-none bg-gold-gradient px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-navy-deep"
            >
              <Download className="h-3.5 w-3.5" /> Install
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem(DISMISS_KEY, "1");
                setEvt(null);
              }}
              className="inline-flex items-center rounded-none-none border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
