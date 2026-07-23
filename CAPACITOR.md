# Build ZPoS as a native app (Android / iOS) with Capacitor

ZPoS is a Progressive Web App. To ship it on the Play Store / App Store,
wrap the built site with Capacitor. Everything below runs on your own
computer, not inside Lovable.

## 1. Prerequisites

- Node.js 20+ and `bun` (or `npm`/`pnpm`)
- **Android**: Android Studio + JDK 17
- **iOS**: macOS with Xcode 15+ and CocoaPods (`sudo gem install cocoapods`)

## 2. Get the code locally

1. In Lovable, click **GitHub → Connect to GitHub** and export the repo.
2. Clone it and install deps:

```bash
git clone <your-repo-url> zpos
cd zpos
bun install
```

## 3. Add Capacitor

```bash
bun add @capacitor/core @capacitor/cli
bun add @capacitor/android @capacitor/ios
# optional but recommended
bun add @capacitor/splash-screen @capacitor/status-bar @capacitor/app @capacitor/preferences
```

`capacitor.config.ts` is already committed at the project root
(`appId: ai.zetiora.zpos`, `appName: ZPoS`, `webDir: dist`).

## 4. Initialize native projects

```bash
bun run build          # produces /dist
bunx cap add android   # creates /android
bunx cap add ios       # creates /ios (macOS only)
bunx cap sync
```

## 5. Run on a device / emulator

```bash
# Android
bunx cap open android      # then Run ▶ in Android Studio

# iOS
bunx cap open ios          # then Run ▶ in Xcode
```

## 6. Update the app after code changes

Every time you change web code:

```bash
bun run build
bunx cap sync
```

## 7. Icons & splash

Drop a 1024×1024 PNG at `resources/icon.png` and
`resources/splash.png`, then:

```bash
bun add -D @capacitor/assets
bunx capacitor-assets generate
```

## 8. Cloud sync in the native app

The Cloud Sync feature in **Settings → Cloud Sync** works out of the
box inside Capacitor — it uses HTTPS calls to Lovable Cloud
(Supabase). No extra native config required.

## 9. Release builds

- **Android**: Android Studio → `Build → Generate Signed Bundle / APK`.
- **iOS**: Xcode → `Product → Archive → Distribute App`.

## Troubleshooting

- White screen on device: check the `webDir` in `capacitor.config.ts`
  matches your build output (`dist`).
- Mixed-content errors: keep `androidScheme: "https"` (already set).
- Data disappears after reinstall: users must **Back up now** in
  Settings → Cloud Sync before uninstalling.
