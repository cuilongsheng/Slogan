import { createRequire } from 'node:module';
import { fileURLToPath, URL } from 'node:url';
const requireMobile = createRequire(new URL('../../apps/mobile/package.json', import.meta.url));
const root = fileURLToPath(new URL('.', import.meta.url));
const mock = fileURLToPath(new URL('adapters.mjs', import.meta.url));

export default {
  root,
  esbuild: { jsx: 'automatic' },
  optimizeDeps: {
    noDiscovery: true,
    include: [
      'react',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-dom/client',
      'react-native',
    ],
  },
  define: { 'process.env.EXPO_PUBLIC_API_BASE_URL': JSON.stringify('http://localhost:8094') },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      { find: /^react-native$/, replacement: requireMobile.resolve('react-native-web') },
      { find: /^react$/, replacement: requireMobile.resolve('react') },
      {
        find: /^react\/jsx-dev-runtime$/,
        replacement: requireMobile.resolve('react/jsx-dev-runtime'),
      },
      { find: /^react\/jsx-runtime$/, replacement: requireMobile.resolve('react/jsx-runtime') },
      { find: /^react-dom\/client$/, replacement: requireMobile.resolve('react-dom/client') },
      {
        find: /^(expo-router|expo-crypto|expo-localization|expo-status-bar|expo-linear-gradient|react-native-safe-area-context)$/,
        replacement: mock,
      },
    ],
  },
  plugins: [
    {
      name: 'explicit-voice-verification-adapters',
      enforce: 'pre',
      resolveId(source, importer) {
        if (
          importer?.endsWith('/VoiceRoomScreen.tsx') &&
          ['../auth', './session', './media'].includes(source)
        )
          return mock;
        if (source === '../auth') return mock;
        if (source.endsWith('/services/usePrivateRecorder')) return mock;
      },
    },
  ],
  server: {
    host: 'localhost',
    port: 8094,
    strictPort: true,
    fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] },
  },
};
