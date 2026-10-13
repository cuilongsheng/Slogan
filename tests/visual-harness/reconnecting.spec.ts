import { expect, test } from '@playwright/test';

test('SDK recovery preserves the room, member controls and chat draft without a blocking screen', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-10T00:00:00Z') });
  await page.route('**/v1/rooms/visual-room/messages*', (route) =>
    route.fulfill({ json: { items: [], nextCursor: 'cursor', hasMore: false } }),
  );
  await page.goto('/?connection=reconnecting&role=host&recoverAfter=60000');
  await expect(page.getByText('正在重连', { exact: true })).toBeVisible();
  await expect(page.getByText('聊聊旅行中的意外收获', { exact: true })).toBeVisible();
  await expect(page.getByTestId('reconnecting-panel')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '打开麦克风', exact: true })).toBeDisabled();
  await page.getByRole('textbox', { name: '说点什么…', exact: true }).fill('Preserve my draft');
  await page.clock.runFor(45_000);
  await expect(page.getByText('正在重连', { exact: true })).toBeVisible();
  await page.clock.runFor(15_000);
  await expect(page.getByText('●\u00a0 LIVE', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '说点什么…', exact: true })).toHaveValue(
    'Preserve my draft',
  );
  await page.screenshot({ path: 'docs/acceptance/room-usability/runtime-recovered.png' });
});

for (const control of ['返回', '退出房间']) {
  test(`inline recovery allows ${control} to exit directly`, async ({ page }) => {
    await page.goto('/?connection=reconnecting');
    await expect(page.getByText('正在重连', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: control, exact: true }).click();
    await expect(page).toHaveURL(/\/rooms$/);
  });
}
