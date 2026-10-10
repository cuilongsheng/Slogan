import { expect, test } from '@playwright/test';

const evidence = 'docs/acceptance/room-list-fidelity';
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
  await expect(page.getByText('4 个房间', { exact: true })).toBeVisible();
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
