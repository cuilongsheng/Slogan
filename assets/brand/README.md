# Slogan brand assets

`slogan-logo.png` is the existing project artwork used by the mobile login and admin UI.

Android uses two deterministic derivatives of that same artwork:

- `android-icon.png`: 1024 × 1024, white background, centered logo; used for legacy square and round launcher icons.
- `android-adaptive-foreground.png`: 1024 × 1024 transparent foreground. The complete artwork fits Android's guaranteed centered 66 dp circular safe zone within its 108 dp layer, including the speech bubble tail and colored accents.

Regenerate with the repository Node version active: `node scripts/generate-android-icons.mjs`. The script uses the existing Expo image utilities and preserves the artwork; it does not redraw or recolor it. Then run Android-only Expo prebuild to synchronize native resources before assembling the APK. The native `android/` folder is generated and ignored by Git, so changing it alone would not survive a fresh build.

Android icon settings live in `apps/mobile/app.config.js`. No iOS icon configuration is changed.
