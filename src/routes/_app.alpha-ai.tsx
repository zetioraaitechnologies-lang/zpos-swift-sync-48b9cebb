import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_app/alpha-ai")({
  component: AlphaPage,
});

function AlphaPage() {
  const prompts = [
    "How much did I sell today?",
    "Show today's revenue",
    "Which products have low stock?",
    "Which products sold the most?",
    "Show my expenses",
    "Nionyeshe mauzo ya leo",
    "Bidhaa gani zimeuzwa zaidi?",
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="grid h-14 w-14 place-items-center bg-gold-gradient clip-cut-sm">
          <Sparkles className="h-7 w-7 text-black" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-wider">
            Alpha AI
          </h1>
          <p className="text-sm text-muted-foreground">
            Ask about your business — English or Kiswahili
          </p>
        </div>
      </div>

      <div className="panel clip-cut-card p-6">
        <p className="text-sm text-muted-foreground">
          Alpha AI reads your ZPOS data locally on this device and answers
          instantly — even offline. Tap the floating gold button in the corner
          to start a chat.
        </p>
        <div className="mt-6">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gold">
            Try asking
          </div>
          <div className="flex flex-wrap gap-2">
            {prompts.map((p) => (
              <span
                key={p}
                className="rounded-full border border-[color:var(--gold)]/30 bg-black/40 px-3 py-1 text-xs"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
