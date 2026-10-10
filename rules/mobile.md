# Mobile Frontend Rules

## Stack and Routing

- Mobile uses React Native, Expo, and TypeScript. Do not introduce a second mobile framework.
- Use React Native StyleSheet and semantic theme tokens. Desktop use of Tailwind does not justify shared DOM styles or introducing NativeWind by default.
- Expo Router owns file routes and route layouts in top-level `app/`; business implementation lives in `src/features/`.
- Route files read parameters, compose providers and feature screens, and declare navigation options. They do not implement API, LiveKit, or permission workflows directly.

## Feature and Device Ownership

- Organize mobile around business features such as `auth`, `profile`, `room-discovery`, `voice-room`, and `reporting`.
- Wrap microphones, system permissions, secure storage, device language, and realtime SDKs in `src/services/`.
- `voice-room` orchestrates room behavior. `services/realtime` wraps LiveKit technical capabilities without deciding host transfer, removal, or reentry rules.
- Root `components/ui` contains cross-feature React Native primitives; do not share React DOM components from the desktop admin.
- Express platform-specific behavior through `.ios.*`, `.android.*`, or `.native.*` files. Avoid scattered, untestable platform checks in business components.

## Permissions and Lifecycle

- Explicitly handle microphone permission states: not requested, allowed, denied, permanently denied, and return from system settings.
- Foreground/background transitions, system interruptions, audio device changes, and disconnections must not silently corrupt room state.
- Store tokens, account credentials, and sensitive local state securely, never in ordinary logs or unencrypted persistence.
- Device language supplies only a default. Actual language behavior follows current requirements; services must not invent product rules.

## Realtime UI

- Distinguish application room state, LiveKit connection state, and local microphone state; one boolean cannot represent all three.
- Clean up subscriptions, event listeners, and reconnect timers when their lifecycle ends.
- After network recovery, reconfirm membership against server state rather than trusting cached client state or old tokens.

## Testing and Evidence

- Use suitable unit/integration tests for pure logic, hooks, and adapters.
- Playwright can cover related web administration flows but does not establish React Native device acceptance.
- Microphone permissions, system language, app lifecycle, network reconnection, and audio publication/subscription require emulator or physical-device runtime evidence.
- Compare mobile pages involving Figma against the original frame at the target device dimensions and record differences.
