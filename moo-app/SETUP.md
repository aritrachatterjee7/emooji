# eMooJI — Expo Setup Guide
## iOS · Android · Web PWA from one codebase

---

## 1. Prerequisites

```bash
# Node.js 18+
node --version

# Install Expo CLI and EAS CLI globally
npm install -g expo-cli eas-cli

# iOS: Xcode 15+ (Mac only) — install from App Store
# Android: Android Studio + SDK Platform 34
```

---

## 2. Create your Expo / EAS account

```bash
# Create account at https://expo.dev — free tier is enough
# Then login:
eas login
```

---

## 3. Download the Syne + DM Mono fonts

Expo needs the font files locally for native builds.

Download these files and place them in `assets/fonts/`:

| File | Download from |
|---|---|
| `Syne-Regular.ttf`   | https://fonts.google.com/specimen/Syne |
| `Syne-Medium.ttf`    | (same download, multiple weights) |
| `Syne-Bold.ttf`      | |
| `Syne-ExtraBold.ttf` | |
| `DMMono-Regular.ttf` | https://fonts.google.com/specimen/DM+Mono |
| `DMMono-Medium.ttf`  | |

```
assets/
  fonts/
    Syne-Regular.ttf
    Syne-Medium.ttf
    Syne-Bold.ttf
    Syne-ExtraBold.ttf
    DMMono-Regular.ttf
    DMMono-Medium.ttf
  icons/
    icon-192.png      ← 192×192 app icon
    icon-512.png      ← 512×512 app icon
    icon-1024.png     ← 1024×1024 for App Store
    adaptive-icon.png ← 1024×1024 Android adaptive foreground
```

---

## 4. Get Google Maps API keys

Required for `react-native-maps` on iOS and Android.

1. Go to https://console.cloud.google.com
2. Create a project → Enable **Maps SDK for Android** and **Maps SDK for iOS**
3. Create two API keys (one per platform, restrict each to its platform)
4. Replace placeholders in `app.json`:

```json
"ios":     { "config": { "googleMapsApiKey": "YOUR_IOS_KEY_HERE" } }
"android": { "config": { "googleMaps": { "apiKey": "YOUR_ANDROID_KEY_HERE" } } }
```

---

## 5. Configure your backend URL

Edit `eas.json` — set your Render deployment URL in `preview` and `production`:

```json
"EXPO_PUBLIC_PROXY_URL": "https://your-app.onrender.com"
```

For local dev, leave it as `http://localhost:3000` in the `development` profile.

On Android emulator, use `http://10.0.2.2:3000` instead of `localhost`.
On iOS simulator, `http://localhost:3000` works fine.

---

## 6. Install dependencies

```bash
cd emooji-expo
npm install
```

---

## 7. Run in development

### Web PWA (fastest to start)
```bash
# Terminal 1 — API proxy
node proxy.js

# Terminal 2 — Expo web dev server
npx expo start --web
# Opens at http://localhost:8081
# The web build proxies /api → port 3000 automatically
```

### iOS Simulator (Mac only)
```bash
npx expo start --ios
# Requires Xcode. Press 'i' in the Expo terminal to open simulator.
```

### Android Emulator
```bash
npx expo start --android
# Requires Android Studio + a virtual device running.
```

### Physical device (fastest real test)
```bash
# Install "Expo Go" from App Store / Play Store on your phone
npx expo start
# Scan the QR code in the terminal with Expo Go
```

---

## 8. Build for production

### Web PWA
```bash
# Build static files → dist/
npx expo export --platform web

# Serve via your proxy
node proxy.js
# The proxy serves dist/ as static files and /api/* as API
```

Deploy to Render:
- Service type: **Web Service**
- Build command: `npm install && npx expo export --platform web`
- Start command: `node proxy.js`
- This is the **same Render service** as your existing moo-app — just replace the build command.

### Android APK (internal testing)
```bash
eas build --platform android --profile preview
# Downloads a .apk — install directly on any Android device
```

### Android AAB (Play Store)
```bash
eas build --platform android --profile production
# Uploads .aab to your EAS dashboard
# Then: eas submit --platform android
```

### iOS (App Store / TestFlight)
```bash
eas build --platform ios --profile production
# EAS builds on Apple's infrastructure — no Mac required
# Then: eas submit --platform ios
```

---

## 9. Submit to stores

### Google Play Store
1. Create app at https://play.google.com/console
2. Generate a service account key → save as `google-service-account.json`
3. Update `eas.json` with `serviceAccountKeyPath`
4. Run: `eas submit --platform android`

### Apple App Store
1. Enroll in Apple Developer Program ($99/year) at https://developer.apple.com
2. Create app in App Store Connect → get your App ID and Team ID
3. Update `eas.json` with `appleId`, `ascAppId`, `appleTeamId`
4. Run: `eas submit --platform ios`

---

## 10. Environment variables

Never commit API keys. Use `.env` locally:

```bash
# .env  (gitignored)
JACKDAW_CLIENT_ID=your_client_id
JACKDAW_CLIENT_SECRET=your_client_secret
EXPO_PUBLIC_PROXY_URL=http://localhost:3000
```

On Render: set these in Dashboard → Environment.

---

## Project structure recap

```
emooji-expo/
├── app/
│   ├── _layout.jsx        ← Expo Router root (fonts, splash, safe area)
│   └── index.jsx          ← Main screen (all state, layout switching)
├── src/
│   ├── components/
│   │   ├── FieldMap.web.jsx      ← Leaflet map (web only)
│   │   ├── FieldMap.native.jsx   ← react-native-maps (iOS + Android)
│   │   ├── MapToolbar.jsx        ← Shared draw tool buttons
│   │   ├── FieldStatsBar.jsx     ← Area/perimeter overlay
│   │   ├── ChatPanel.jsx         ← Messages + input (shared)
│   │   ├── TopNav.jsx            ← Header (shared)
│   │   └── BottomNav.jsx         ← Mobile tab bar (shared)
│   ├── hooks/
│   │   └── useJackDaw.js         ← All API logic (shared)
│   ├── utils/
│   │   └── markdown.js           ← HTML + native markdown parsers
│   └── constants/
│       └── tokens.js             ← Design tokens (colors, fonts, spacing)
├── assets/
│   ├── fonts/                    ← Syne + DM Mono TTF files (add manually)
│   └── icons/                    ← App icons (add manually)
├── proxy.js                      ← Node.js API proxy (unchanged)
├── app.json                      ← Expo config
├── eas.json                      ← EAS Build config
├── babel.config.js
└── metro.config.js
```

---

## Platform behaviour summary

| Feature | iOS | Android | Web PWA |
|---|---|---|---|
| Map engine | Google Maps (react-native-maps) | Google Maps | Leaflet |
| Draw polygon | Tap vertices + long-press to close | Same | Leaflet Draw toolbar |
| Draw rectangle | Tap two corners | Same | Leaflet Draw toolbar |
| Offline tiles | No (future: react-native-fs) | No | Yes (Workbox) |
| Install to home | App Store | Play Store | Browser install prompt |
| Push notifications | expo-notifications (Phase 2) | Same | sw.js push (Phase 2) |
| Safe area | react-native-safe-area-context | Same | CSS env() |
