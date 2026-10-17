// Opt-in provider/media acceptance. Only disposable script-owned rooms are touched.
// Synthetic tones exercise real Cloud transport without collecting microphone audio.
/* global window, document, AudioContext, MediaStream */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '@playwright/test';
import { databaseFingerprint } from '../../apps/api/scripts/postgres-backup-envelope.mjs';

const requireApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
requireApi('reflect-metadata');
const { ConfigService } = requireApi('@nestjs/config');
const { LivekitAdapter } =
  await import('../../apps/api/dist/infrastructure/livekit/livekit.adapter.js');
if (
  process.env.CONFIRM_LIVEKIT_SMOKE !== 'production' ||
  process.env.EXPECTED_DATABASE_FINGERPRINT !== databaseFingerprint(process.env.DATABASE_URL) ||
  !process.env.LIVEKIT_API_KEY ||
  !process.env.LIVEKIT_API_SECRET ||
  !/^wss:\/\/[a-z0-9-]+\.livekit\.cloud$/.test(process.env.LIVEKIT_URL ?? '')
)
  throw new Error('LIVEKIT_SMOKE_TARGET_NOT_APPROVED');
const provider = new LivekitAdapter(new ConfigService({ ...process.env, REALTIME_ENABLED: true }));
const roomId = randomUUID();
const identities = [randomUUID(), randomUUID(), randomUUID()];
const checks = [];
const sdk = await readFile(
  new URL(
    '../../apps/mobile/node_modules/livekit-client/dist/livekit-client.umd.js',
    import.meta.url,
  ),
);
const server = createServer((req, res) => {
  res.setHeader('cache-control', 'no-store');
  res.setHeader('content-type', req.url === '/sdk.js' ? 'text/javascript' : 'text/html');
  res.end(
    req.url === '/sdk.js'
      ? sdk
      : '<!doctype html><title>Owned Cloud media acceptance</title><script src="/sdk.js"></script>',
  );
});
let browser;
let stage = 'release-identity';
async function waitFor(check, code, timeout = 30000) {
  const until = Date.now() + timeout;
  while (!(await check())) {
    if (Date.now() >= until) throw new Error(code);
    await delay(200);
  }
}
async function connect(page, token) {
  return page.evaluate(
    async ({ url, token }) => {
      const sdk = window.LivekitClient;
      sdk.setLogLevel('silent');
      const room = new sdk.Room();
      window.acceptance = { room, samples: [], audio: [] };
      room.on(sdk.RoomEvent.TrackSubscribed, (track) => {
        if (track.kind !== sdk.Track.Kind.Audio) return;
        const playback = track.attach();
        playback.volume = 0;
        document.body.append(playback);
        void playback.play().catch(() => undefined);
        const context = new AudioContext();
        const analyser = context.createAnalyser();
        const silentOutput = context.createGain();
        silentOutput.gain.value = 0;
        context
          .createMediaStreamSource(new MediaStream([track.mediaStreamTrack]))
          .connect(analyser);
        analyser.connect(silentOutput).connect(context.destination);
        window.acceptance.audio.push({ context, analyser });
        void context.resume();
      });
      await room.connect(url, token, { autoSubscribe: true });
      return room.state === 'connected';
    },
    { url: process.env.LIVEKIT_URL, token },
  );
}
async function publish(page, frequency) {
  await page.evaluate(async (frequency) => {
    const context = new AudioContext();
    await context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const destination = context.createMediaStreamDestination();
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.1;
    oscillator.connect(gain).connect(destination);
    oscillator.start();
    window.acceptance.audio.push({ context, oscillator });
    await window.acceptance.room.localParticipant.publishTrack(
      destination.stream.getAudioTracks()[0],
      {
        source: window.LivekitClient.Track.Source.Microphone,
      },
    );
  }, frequency);
}
async function audible(page) {
  return page.evaluate(async () => {
    if (
      window.acceptance.audio.some(({ analyser }) => {
        if (!analyser) return false;
        const samples = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(samples);
        return (
          Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length) > 0.005
        );
      })
    )
      return true;
    for (const participant of window.acceptance.room.remoteParticipants.values())
      for (const publication of participant.audioTrackPublications.values()) {
        const stats = await publication.track?.getReceiverStats();
        if (stats?.bytesReceived > 1000 && stats.totalAudioEnergy > 0.000001) return true;
      }
    return false;
  });
}
try {
  const response = await fetch('https://slogan-api-pi.vercel.app/v1/auth/capabilities', {
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.headers.get('x-slogan-commit'), process.env.SLOGAN_RELEASE_COMMIT);
  stage = 'create-owned-room';
  await provider.ensureRoom(roomId, 4, 'owned-cloud-media-acceptance');
  stage = 'minimum-grants';
  const tokens = await Promise.all(
    identities.map((identity) => provider.token(roomId, identity, 300)),
  );
  for (const token of tokens) {
    const claims = JSON.parse(Buffer.from(token.token.split('.')[1], 'base64url').toString());
    assert.equal(claims.video.canPublishData, false);
    assert.equal(claims.video.roomAdmin, false);
    assert.deepEqual(claims.video.canPublishSources, ['microphone']);
  }
  checks.push('minimum-grants');
  stage = 'launch-clients';
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const pages = await Promise.all(
    tokens.map(async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      return page;
    }),
  );
  stage = 'connect-clients';
  assert(await connect(pages[0], tokens[0].token));
  assert(await connect(pages[1], tokens[1].token));
  checks.push('two-independent-cloud-clients');
  stage = 'publish-first-tone';
  await publish(pages[0], 440);
  stage = 'publish-second-tone';
  await publish(pages[1], 660);
  stage = 'bidirectional-audio';
  try {
    await waitFor(
      async () => (await audible(pages[0])) && (await audible(pages[1])),
      'LIVEKIT_SMOKE_BIDIRECTIONAL_AUDIO_FAILED',
    );
  } catch (error) {
    const media = await Promise.all(
      pages.slice(0, 2).map((page) =>
        page.evaluate(async () => {
          const tracks = [];
          for (const participant of window.acceptance.room.remoteParticipants.values())
            for (const publication of participant.audioTrackPublications.values()) {
              const stats = await publication.track?.getReceiverStats();
              tracks.push({
                subscribed: publication.isSubscribed,
                receivedBytes: stats?.bytesReceived ?? 0,
                energy: stats?.totalAudioEnergy ?? 0,
              });
            }
          return {
            audioContexts: window.acceptance.audio.map(({ context, analyser }) => ({
              state: context.state,
              analyser: Boolean(analyser),
            })),
            tracks,
          };
        }),
      ),
    );
    console.log(JSON.stringify({ mediaDiagnostics: media }));
    throw error;
  }
  checks.push('bidirectional-synthetic-audio-energy');
  stage = 'online-revocation';
  await provider.revoke(roomId, identities[1]);
  await waitFor(
    () => pages[1].evaluate(() => window.acceptance.room.state === 'disconnected'),
    'LIVEKIT_SMOKE_ONLINE_REVOKE_FAILED',
  );
  let rejected = false;
  try {
    await connect(pages[1], tokens[1].token);
  } catch {
    rejected = true;
  }
  assert(rejected, 'Old online credential remained usable');
  checks.push('online-revocation-rejects-old-token');
  stage = 'offline-revocation';
  assert(await connect(pages[2], tokens[2].token));
  await pages[2].evaluate(() => window.acceptance.room.disconnect());
  await provider.revoke(roomId, identities[2]);
  rejected = false;
  try {
    await connect(pages[2], tokens[2].token);
  } catch {
    rejected = true;
  }
  assert(rejected, 'Old offline credential remained usable');
  checks.push('offline-revocation-rejects-old-token');
  stage = 'fresh-identity';
  const fresh = await provider.token(roomId, randomUUID(), 300);
  assert(await connect(pages[1], fresh.token));
  checks.push('fresh-identity-connects-after-revocation');
  stage = 'delete-owned-room';
  await provider.deleteRoom(roomId);
  await waitFor(
    async () =>
      (
        await Promise.all(
          [pages[0], pages[1]].map((p) =>
            p.evaluate(() => window.acceptance.room.state === 'disconnected'),
          ),
        )
      ).every(Boolean),
    'LIVEKIT_SMOKE_DELETE_DISCONNECT_FAILED',
  );
  checks.push('delete-room-disconnects-clients');
  console.log(
    JSON.stringify({
      checkedAt: new Date().toISOString(),
      release: process.env.SLOGAN_RELEASE_COMMIT,
      evidence: 'actual Cloud with two Chromium clients and synthetic audio; no microphone capture',
      checks,
      webhook: 'not verified by this provider-only probe',
      businessLifecycle: 'not verified by this provider-only probe',
    }),
  );
} catch (error) {
  let detail = String(error?.message ?? '')
    .replace(/(?:https?|wss?):\/\/\S+/g, '[endpoint]')
    .replace(/eyJ[A-Za-z0-9_.-]+/g, '[credential]');
  for (const key of ['LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'])
    if (process.env[key]) detail = detail.replaceAll(process.env[key], '[credential]');
  console.error(
    JSON.stringify({
      result: 'LIVEKIT_CLOUD_SMOKE_FAILED',
      stage,
      checks,
      errorType: /^[A-Za-z]{1,40}$/.test(error?.name ?? '') ? error.name : 'Error',
      detail: detail.slice(0, 240),
    }),
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
  try {
    await provider.deleteRoom(roomId);
    assert.equal((await provider.participants(roomId)).roomSid, null);
    console.log('{"ownedProviderRoomCleanup":"SUCCEEDED"}');
  } catch {
    console.error('LIVEKIT_CLOUD_SMOKE_CLEANUP_FAILED');
    process.exitCode = 1;
  }
  server.close();
}
