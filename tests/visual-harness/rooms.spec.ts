import { expect, test } from '@playwright/test';

const evidence = 'docs/acceptance/main-pages-live-updates/runtime';
test.use({ deviceScaleFactor: 3 });
const now = new Date('2026-10-10T09:00:00Z');
const rooms = [
  ['聊聊旅行中的意外收获', 'Luna', 4, 38, false],
  ['工作中的英语表达', 'Mika', 3, 52, true],
  ['下班后最喜欢做什么', 'Derek', 5, 24, false],
  ['第一次开口说英语', 'Nora', 6, 60, false],
].map(([topic, host, memberCount, minutes, password], index) => ({
  id: `room-${index}`,
  hostUserId: `host-${index}`,
  hostDisplayName: host,
  visibility: 'PUBLIC',
  topic,
  cefrLevel: 'B1',
  cefrLevelMin: 'B1',
  cefrLevelMax: 'B1',
  capacity: 6,
  memberCount,
  hostReconnectDeadline: null,
  passwordProtected: password,
  startedAt: now.toISOString(),
  endsAt: new Date(+now + Number(minutes) * 60_000).toISOString(),
  sensitiveSpeechDetectionEnabled: false,
  postRoomKeywordsEnabled: false,
}));

test('real room list matches measured geometry and preserves direct entry', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.setFixedTime(now);
  await page.route('**/v1/rooms?*', (route) => {
    expect(route.request().headers().authorization).toBe('Bearer visual-fixture');
    return route.fulfill({ json: { items: rooms, nextCursor: null } });
  });
  await page.goto('/?screen=rooms');
  await expect(page.getByText('开启畅聊', { exact: true })).toBeVisible();
  await expect(page.getByTestId('rooms-count')).toHaveText('4 个房间 ›');
  await expect(page.getByText('Nora · 房主', { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, (image) => image.decode().catch(() => undefined)),
    );
  });
  for (let i = 0; i < 4; i++) {
    const box = await page.getByTestId(`room-card-room-${i}`).boundingBox();
    expect(box).toEqual({ x: 15, y: 142 + 137 * i, width: 358, height: 132 });
  }
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(dimensions.scrollWidth).toBe(dimensions.viewport);
  await page.screenshot({ path: `${evidence}/runtime-390.png` });
  await page.getByTestId('room-card-room-0').click();
  await expect(page).toHaveURL('/rooms/room-0/session');
  expect(errors).toEqual([]);
});

test('list errors stay retryable and profile/create navigation works', async ({ page }) => {
  let failed = true;
  await page.route('**/v1/rooms?*', (route) =>
    failed
      ? route.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } })
      : route.fulfill({ json: { items: rooms, nextCursor: null } }),
  );
  await page.goto('/?screen=rooms');
  await expect(page.getByText('暂时无法读取房间，请重试。')).toBeVisible();
  failed = false;
  await page.getByText('重试', { exact: true }).click();
  await expect(page.getByText('聊聊旅行中的意外收获', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '创建房间', exact: true }).click();
  await expect(page).toHaveURL('/rooms/create');
  await page.goto('/?screen=rooms');
  await expect(page.getByText('聊聊旅行中的意外收获', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '我的', exact: true }).click();
  await expect(page).toHaveURL('/me');
});

test('Discover shows another actor new room on the next foreground refresh without reloading', async ({
  page,
}) => {
  await page.clock.install({ time: now });
  let visible = [rooms[0]];
  await page.route('**/v1/rooms?*', (route) =>
    route.fulfill({ json: { items: visible, nextCursor: null } }),
  );
  await page.goto('/?screen=rooms');
  await expect(page.getByTestId('room-card-room-0')).toBeVisible();
  visible = [rooms[1], rooms[0]];
  await page.clock.fastForward(5000);
  await expect(page.getByTestId('room-card-room-1')).toBeVisible();
  await expect(page.getByTestId('room-card-room-0')).toBeVisible();
});

test.describe('revised Discover toolbar', () => {
  test.use({ deviceScaleFactor: 1 });
  test('source toolbar stays bounded in both languages and preserves the actual count and creation action', async ({
    page,
  }) => {
    await page.clock.setFixedTime(now);
    const allRooms = Array.from({ length: 12 }, (_, index) => ({
      ...rooms[index % rooms.length],
      id: `room-${index}`,
    }));
    await page.route('**/v1/rooms?*', (route) =>
      route.fulfill({ json: { items: allRooms, nextCursor: null } }),
    );
    await page.goto('/?screen=rooms');
    await expect(page.getByTestId('rooms-count')).toHaveText('12 个房间 ›');
    await page.evaluate(() => document.fonts.ready);
    const filter = page.getByTestId('rooms-all-filter');
    const count = page.getByTestId('rooms-count');
    const burst = page.getByTestId('rooms-speech-burst');
    const create = page.getByRole('button', { name: '创建房间', exact: true });
    expect(await filter.boundingBox()).toEqual({ x: 16, y: 86, width: 57, height: 46 });
    expect(await count.boundingBox()).toEqual({ x: 93, y: 100.5, width: 62, height: 17 });
    expect(await burst.boundingBox()).toEqual({ x: 173, y: 93, width: 32, height: 32 });
    expect(await create.boundingBox()).toEqual({ x: 316, y: 86, width: 46, height: 46 });
    await page.screenshot({ path: 'docs/acceptance/mobile-ui-v3/follow-up/discover-zh.png' });
    await create.click();
    await expect(page).toHaveURL('/rooms/create');
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/?screen=rooms&language=en');
    await expect(page.getByTestId('rooms-count')).toContainText('12 rooms');
    const englishCount = await page.getByTestId('rooms-count').boundingBox();
    const englishBurst = await page.getByTestId('rooms-speech-burst').boundingBox();
    const englishCreate = await page
      .getByRole('button', { name: 'Create a room', exact: true })
      .boundingBox();
    expect(englishCount!.x + englishCount!.width).toBeLessThanOrEqual(englishBurst!.x);
    expect(englishBurst!.x + englishBurst!.width).toBeLessThan(englishCreate!.x);
    await page.screenshot({ path: 'docs/acceptance/mobile-ui-v3/follow-up/discover-en-320.png' });
  });
});
