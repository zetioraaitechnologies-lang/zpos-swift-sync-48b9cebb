# Deploy ZPoS to Vercel

The Lovable preview + `zpos-swift-sync.lovable.app` publish keeps working.
This is only for hosting the same app on your own Vercel account.

## 1. Push to GitHub (already done)

## 2. Import into Vercel
1. https://vercel.com/new → import your GitHub repo.
2. Framework preset: **Other** (Vercel auto-detects the build).
3. Build command: `bun run build` (or `npm run build`).
4. Output: leave empty — nitro emits `.vercel/output` automatically
   because `vite.config.ts` has `nitro: { preset: "vercel" }`.
5. Install command: `bun install` (or leave default).

## 3. Environment variables
In Vercel → Project → Settings → Environment Variables, add:

```
VITE_SUPABASE_URL          = <your Lovable Cloud URL>
VITE_SUPABASE_PUBLISHABLE_KEY = <your publishable key>
SUPABASE_URL               = <same URL>
SUPABASE_PUBLISHABLE_KEY   = <same key>
```

You can copy these from the `.env` file in the repo.

## 4. Deploy
Click **Deploy**. Every push to `main` redeploys automatically.

## Notes
- Cloud Sync (Settings → Cloud Sync) works the same on Vercel — it talks
  to Lovable Cloud over HTTPS.
- PWA install works on the Vercel HTTPS URL exactly like on Lovable's URL.
