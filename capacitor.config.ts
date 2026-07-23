import type { CapacitorConfig } from "@capacitor/cli";

// ZPoS — Capacitor configuration
// After running `bun run build`, Capacitor copies /dist into the native shell.
const config: CapacitorConfig = {
  appId: "ai.zetiora.zpos",
  appName: "ZPoS",
  webDir: "dist",
  bundledWebRuntime: false,
  backgroundColor: "#0d0d0d",
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: "always",
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
