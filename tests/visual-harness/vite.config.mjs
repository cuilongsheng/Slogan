import { setInterval, clearInterval } from 'node:timers';
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
        find: /^(expo-image-manipulator|expo-image-picker|expo-router|expo-crypto|expo-localization|expo-status-bar|expo-linear-gradient|react-native-safe-area-context)$/,
        replacement: mock,
      },
    ],
  },
  plugins: [
    {
      name: 'owned-streaming-event-fixture',
      configureServer(server) {
        const clients = new Map();
        let count = 0;
        server.middlewares.use((req, res, next) => {
          const url = new URL(req.url, 'http://localhost:8094');
          if (url.pathname === '/v1/me/live-updates') {
            if (url.searchParams.get('protocol') !== '2') {
              res.writeHead(400).end();
              return;
            }
            clients.set(
              res,
              new URL(req.headers.referer ?? 'http://localhost:8094').searchParams.get(
                'conversationId',
              ),
            );
            count++;
            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
            });
            res.write('id: fixture-reset\n' + 'data: {"scope":"reset"}\n\n');
            const timer = setInterval(() => res.write(': heartbeat\n\n'), 10000);
            req.on('close', () => {
              clients.delete(res);
              clearInterval(timer);
            });
          } else if (url.pathname === '/__fixture/live') {
            if (req.method === 'POST') {
              const scope = url.searchParams.get('scope');
              const resourceId = url.searchParams.get('resourceId');
              for (const client of clients.keys())
                client.write(
                  'id: fixture-next\n' +
                    'data: ' +
                    JSON.stringify({ scope, ...(resourceId ? { resourceId } : {}) }) +
                    '\n\n',
                );
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                count,
                active: url.searchParams.has('conversationId')
                  ? [...clients.values()].filter(
                      (id) => id === url.searchParams.get('conversationId'),
                    ).length
                  : clients.size,
              }),
            );
          } else next();
        });
      },
    },
    {
      name: 'explicit-voice-verification-adapters',
      enforce: 'pre',
      resolveId(source, importer) {
        if (source.endsWith('/services/chatListAnchor'))
          return fileURLToPath(
            new URL('../../apps/mobile/src/services/chatListAnchor.web.ts', import.meta.url),
          );
        if (
          importer?.endsWith('/VoiceRoomScreen.tsx') &&
          ['../auth', './session', './media'].includes(source)
        )
          return mock;
        if (source === '../auth') return mock;
        if (
          importer?.endsWith('/RoomExitProvider.tsx') &&
          source === '../../services/roomExitStorage'
        )
          return fileURLToPath(
            new URL('../../apps/mobile/src/services/roomExitStorage.web.ts', import.meta.url),
          );
        if (
          importer?.endsWith('/index.ts') &&
          importer.includes('/voice-room/') &&
          source === './media'
        )
          return mock;
        if (importer?.endsWith('/CallScreen.tsx') && source === '../voice-room') return mock;
        if (importer?.endsWith('/locale.ts') && source === './languageStorage')
          return fileURLToPath(
            new URL('../../apps/mobile/src/services/languageStorage.web.ts', import.meta.url),
          );
        if (
          (importer?.endsWith('/ProfileScreens.tsx') || importer?.endsWith('/draft.tsx')) &&
          ['../auth/context', '../auth/session'].includes(source)
        )
          return mock;
        if (source.endsWith('/services/usePrivateRecorder')) return mock;
        if (source.endsWith('/services/shareRoom'))
          return fileURLToPath(
            new URL('../../apps/mobile/src/services/shareRoom.web.ts', import.meta.url),
          );
        if (source.endsWith('/services/roomAudioGesture'))
          return fileURLToPath(
            new URL('../../apps/mobile/src/services/roomAudioGesture.web.ts', import.meta.url),
          );
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
