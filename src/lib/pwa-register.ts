// Guarded PWA service-worker registration.
// Registers ONLY on the published/production app on a real domain — never in
// the Lovable editor preview, dev, or an iframe. In those contexts we
// proactively unregister any leftover SWs so preview stays fresh.

const SW_URL = "/sw.js";

function isForbiddenContext(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (!import.meta.env.PROD) return true;
  } catch {
    // ignore
  }
  if (window.top !== window.self) return true;
  const host = window.location.hostname;
  if (
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev")
  ) {
    return true;
  }
  if (new URL(window.location.href).searchParams.get("sw") === "off") return true;
  return false;
}

export async function registerPwaServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  if (isForbiddenContext()) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(
        regs
          .filter((r) => r.active?.scriptURL?.endsWith(SW_URL))
          .map((r) => r.unregister()),
      );
    } catch {
      // ignore
    }
    return;
  }

  try {
    await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  } catch (e) {
    console.warn("[pwa] SW registration failed", e);
  }
}
