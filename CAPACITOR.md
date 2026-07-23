# Build ZPoS as an Android / iOS app (Capacitor)

Your web app is already PWA-ready. Capacitor lets you wrap the same code as
a real installable Android APK/AAB or iOS app for the stores.

## 1. Prerequisites (once)

- Node 20+ and Bun (or npm)
- **Android:** Android Studio (bundles JDK 17 + SDK)
- **iOS:** macOS + Xcode 15+ + CocoaPods (`sudo gem install cocoapods`)

## 2. Clone your GitHub repo locally

```bash
git clone https://github.com/<you>/<your-zpos-repo>.git
cd <your-zpos-repo>
bun install     # or npm install
```

## 3. Install Capacitor

```bash
bun add @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
```

`capacitor.config.ts` is already in the repo (appId `com.zetiora.zpos`,
appName `ZPoS`, webDir `dist`).

## 4. Build the web assets

```bash
bun run build
```

This produces the production bundle. Capacitor copies from `dist/`.

## 5. Add native platforms

```bash
bunx cap add android
bunx cap add ios       # macOS only
```

## 6. Sync + open

```bash
bunx cap sync
bunx cap open android  # launches Android Studio
bunx cap open ios      # launches Xcode
```

From there:
- **Android Studio → Run ▶** on an emulator or a plugged-in phone.
- **Xcode → Product → Run** on a simulator or a signed device.

## 7. Ship a release build

- **Android:** Build → Generate Signed Bundle / APK → AAB → upload to Google Play.
- **iOS:** Product → Archive → Distribute App → App Store Connect.

## 8. Update after code changes

Every time you push new web code:

```bash
git pull
bun install
bun run build
bunx cap sync
```

Then re-run in Android Studio / Xcode.

## Notes for ZPoS specifically

- Cloud sync uses the same Lovable Cloud backend from the native shell —
  users sign in inside the app and their data syncs across web + mobile.
- The offline database (localStorage) works inside the WebView with no
  changes.
- App icon / splash: drop 1024×1024 icons into `resources/` and run
  `bunx @capacitor/assets generate` (optional).
