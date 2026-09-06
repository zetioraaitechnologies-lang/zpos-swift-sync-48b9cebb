// Alpha AI server function — proxies to Lovable AI Gateway.
// The client sends a compact JSON snapshot of the business + the question;
// the model answers in the same language (English or Kiswahili).
import { createServerFn } from "@tanstack/react-start";

export interface AlphaSnapshot {
  businessName: string;
  currency: string;
  todaySales: { count: number; total: number };
  totalRevenue: number;
  totalProfit: number;
  totalExpenses: number;
  lowStock: { name: string; stock: number; min: number }[];
  topProducts: { name: string; qty: number }[];
  productCount: number;
}

export interface AlphaInput {
  question: string;
  snapshot: AlphaSnapshot;
}

export const askAlpha = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const i = input as AlphaInput;
    if (!i || typeof i.question !== "string" || !i.snapshot) {
      throw new Error("Invalid input");
    }
    return i;
  })
  .handler(async ({ data }) => {
    const geminiKey = process.env['GEMINI_API_KEY'] || process.env['VITE_GEMINI_API_KEY'];
    const lovableKey = process.env['LOVABLE_API_KEY'];
    if (!geminiKey && !lovableKey) {
      throw new Error(
        "Alpha AI is not configured: add GEMINI_API_KEY in your hosting environment variables.",
      );
    }

    const system = `You are Alpha AI, a friendly business assistant for ZPOS by Zetiora AI Technologies.
You answer questions about the user's shop using ONLY the JSON snapshot provided.
Detect the user's language (English or Kiswahili) and reply in the same language.
Keep replies short (1-3 sentences), concrete, and use the currency from the snapshot.
If the snapshot doesn't contain enough info, say so briefly.`;

    const userMsg = `Business snapshot:\n${JSON.stringify(data.snapshot)}\n\nQuestion: ${data.question}`;

    // Preferred: the user's own Gemini API key (works on any host, e.g. Vercel).
    if (geminiKey) {
      const model = process.env['GEMINI_MODEL'] || "gemini-2.0-flash";
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": geminiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: userMsg }] }],
          }),
        },
      );
      if (res.status === 429) throw new Error("Rate limit — please try again in a moment.");
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Gemini error (${res.status}): ${t.slice(0, 200)}`);
      }
      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text =
        json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
      return { text };
    }

    // Fallback: Lovable AI Gateway (preview environment).
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Rate limit — please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please top up in Lovable.");
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`AI gateway error (${res.status}): ${t.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = json.choices?.[0]?.message?.content?.trim() ?? "";
    return { text };
  });

