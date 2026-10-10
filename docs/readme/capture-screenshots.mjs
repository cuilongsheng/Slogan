import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
const requireRoot = createRequire(`${root}/package.json`);
const requireAdmin = createRequire(`${root}/apps/admin/package.json`);
const { chromium } = requireRoot('@playwright/test');
const { createServer } = await import(pathToFileURL(requireAdmin.resolve('vite')));
const { default: config } = await import(
  pathToFileURL(`${root}/tests/visual-harness/vite.config.mjs`)
);
config.configFile = false;
config.plugins.push({
  name: 'readme-english-fixture',
  enforce: 'pre',
  transform(code, id) {
    if (!id.endsWith('/tests/visual-harness/adapters.mjs')) return;
    return code
      .replace(
        "languageTag: 'zh-CN', languageCode: 'zh'",
        "languageTag: 'en-US', languageCode: 'en'",
      )
      .replace("topic: '聊聊旅行中的意外收获'", "topic: 'Unexpected discoveries while traveling'");
  },
});
const server = await createServer(config);
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: 'en-US',
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-09-28T09:00:00Z'));
  await page.route('**/v1/rooms?*', (route) =>
    route.fulfill({
      json: {
        items: [
          ['Unexpected discoveries while traveling', 'Luna', 4, 38, false],
          ['English expressions at work', 'Mika', 3, 52, true],
          ['What do you enjoy after work?', 'Derek', 5, 24, false],
          ['Your first English conversation', 'Nora', 6, 60, false],
        ].map(([topic, hostDisplayName, memberCount, minutes, passwordProtected], i) => ({
          id: `room-${i}`,
          hostUserId: `host-${i}`,
          hostDisplayName,
          visibility: 'PUBLIC',
          topic,
          cefrLevel: 'B1',
          cefrLevelMin: 'B1',
          cefrLevelMax: 'B2',
          capacity: 6,
          memberCount,
          hostReconnectDeadline: null,
          passwordProtected,
          startedAt: '2026-09-28T09:00:00Z',
          endsAt: new Date(Date.parse('2026-09-28T09:00:00Z') + minutes * 60000).toISOString(),
          sensitiveSpeechDetectionEnabled: false,
          postRoomKeywordsEnabled: false,
        })),
        nextCursor: null,
      },
    }),
  );
  await page.route('**/v1/rooms/visual-room/messages*', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: 'sample-message',
            sequence: '1',
            senderUserId: 'user-1',
            senderDisplayName: 'Mika',
            text: 'Hello everyone! Where did you travel last?',
            createdAt: '2026-09-28T09:00:00Z',
          },
        ],
        nextCursor: 'fixture-cursor',
        hasMore: false,
      },
    }),
  );
  await page.route('**/v1/people/available*', (route) =>
    route.fulfill({
      json: {
        items: [
          { userId: 'idle-1', displayName: 'Alex', cefrLevel: 'B1', isAvailable: true },
          { userId: 'idle-2', displayName: 'Jordan', cefrLevel: 'B2', isAvailable: true },
        ],
        nextCursor: null,
      },
    }),
  );
  await page.route('**/v1/me/speech-processing-consents', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            purpose: 'AI_EXPRESSION_AUDIO',
            status: 'ACCEPTED',
            currentNoticeVersion: 'fixture-v2',
          },
        ],
      },
    }),
  );
  await page.route('**/v1/rooms/visual-room/expression-assistance/audio', (route) =>
    route.fulfill({
      json: { primary: { text: 'I missed the train, but the detour led me to a great café.' } },
    }),
  );
  const shot = async (name) => {
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images, (x) => x.decode().catch(() => {})));
    });
    await page.screenshot({ path: `${root}/docs/readme/images/${name}.png` });
    console.log(`Saved ${name}`);
  };
  await page.goto('http://localhost:8094/?screen=rooms');
  await page.getByTestId('room-card-room-0').waitFor();
  await shot('rooms');
  await page.goto('http://localhost:8094/?screen=create');
  await page.getByRole('textbox').first().fill('Weekend travel stories');
  await shot('create-room');
  await page.goto('http://localhost:8094/?role=host');
  await page.getByTestId('room-seat-row-0').waitFor();
  await shot('voice-room');
  await page
    .getByRole('button', {
      name: 'Find English in your language · Only visible to you',
      exact: true,
    })
    .click();
  const hold = page.getByRole('button', { name: 'Hold to speak', exact: true });
  await hold.hover();
  await page.mouse.down();
  await page.getByText('00:00 / 00:10', { exact: true }).waitFor();
  await page.mouse.up();
  await page
    .getByText('I missed the train, but the detour led me to a great café.', { exact: true })
    .waitFor();
  await shot('expression-assistance');
  await page.goto('http://localhost:8094/?count=2&capacity=4&role=host');
  await page.getByTestId('room-empty-seat-2').click();
  await page.getByText('Alex', { exact: true }).waitFor();
  await shot('invite');
  await page.goto('http://localhost:8094/?connection=reconnecting&role=host');
  await page.getByTestId('reconnecting-panel').waitFor();
  await shot('reconnecting');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(
    'Captured six English runtime screenshots without modifying application or harness source.',
  );
} finally {
  await browser?.close();
  await server.close();
}
