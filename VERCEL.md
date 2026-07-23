# Deploying ZPoS to Vercel

The project is already Vercel-ready: `vite.config.ts` sets
`nitro: { preset: "vercel" }`, which produces a Vercel build output
(`.vercel/output`) during `bun run build`.

## 1. Push to GitHub

You've already done this. Vercel will pull directly from your repo.

## 2. Import to Vercel

1. Go to https://vercel.com/new.
2. Pick your GitHub repo.
3. **Framework Preset:** Other (Vite/Nitro auto-detected — leave defaults).
4. **Build Command:** `bun run build` (or `npm run build`).
5. **Output Directory:** leave blank — Nitro's Vercel preset writes
   `.vercel/output` automatically.
6. **Install Command:** `bun install` (or `npm install`).

## 3. Environment variables

Add these in Vercel → Settings → Environment Variables (Production + Preview).
Copy the values from Lovable → Backend (they're already set here):

| Name                            | Where used |
| ------------------------------- | ---------- |
| `VITE_SUPABASE_URL`             | Browser + SSR |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser + SSR |
| `VITE_SUPABASE_PROJECT_ID`      | Browser |
| `SUPABASE_URL`                  | Server functions |
| `SUPABASE_PUBLISHABLE_KEY`      | Server functions |

Do **not** add `SUPABASE_SERVICE_ROLE_KEY` unless a future server function
needs it — this project doesn't.

## 4. Deploy

Click **Deploy**. Vercel builds and gives you a live URL like
`zpos-yourname.vercel.app`. Every push to `main` re-deploys automatically.

## 5. Custom domain

Vercel → Settings → Domains → add your domain and follow the DNS steps.

## Notes

- The Lovable preview and Vercel deploy can coexist — they read the same
  Lovable Cloud database, so cloud-synced users see identical data on both.
- The PWA install prompt and service worker only activate on the
  Vercel/published domain (not inside the Lovable editor iframe).
