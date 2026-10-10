import { expect, test } from '@playwright/test';

test.use({ deviceScaleFactor: 3 });

test('reconnect follows the submitted layout and restores the room after media recovery', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-10-10T00:00:00Z') });
  await page.route('**/v1/rooms/visual-room/messages*', (route) =>
    route.fulfill({ json: { items: [], nextCursor: 'cursor', hasMore: false } }),
  );
  await page.goto('/?connection=reconnecting&role=host&recoverAfter=60000');
  await expect(page.getByText('正在重连', { exact: true })).toBeVisible();
  await expect(page.getByText('00:42', { exact: true })).toBeVisible();
  const panel = await page.getByTestId('reconnecting-panel').boundingBox();
  expect(panel).toMatchObject({ x: 16, y: 173, width: 358, height: 345 });
  const leave = await page.getByTestId('reconnecting-leave').boundingBox();
  expect(leave).toMatchObject({ x: 18, y: 564, width: 350, height: 56 });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'docs/acceptance/reconnecting-layout/runtime-390.png' });
  await page.clock.runFor(45_000);
  await expect(page.getByText('00:00', { exact: true })).toBeVisible();
  await expect(page.getByTestId('reconnecting-panel')).toBeVisible();
  await page.clock.runFor(15_000);
  await expect(page.getByTestId('reconnecting-panel')).toHaveCount(0);
  await expect(page.getByText('聊聊旅行中的意外收获')).toBeVisible();
  expect(errors).toEqual([]);
});

for (const control of ['reconnecting-back', 'reconnecting-leave']) {
  test(`${control} leaves membership and navigates to discovery`, async ({ page }) => {
    await page.goto('/?connection=reconnecting');
    await expect(page.getByTestId('reconnecting-panel')).toBeVisible();
    await page.getByTestId(control).click();
    await expect(page).toHaveURL(/\/rooms$/);
  });
}
