import { expect, test, type Page } from '@playwright/test';
const evidence = 'docs/acceptance/mobile-ui-v3/runtime';
async function capture(page: Page, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, (image) => image.decode().catch(() => undefined)),
    );
  });
  await page.screenshot({ path: `${evidence}/${name}.png` });
}
for (const screen of ['partners', 'messages'] as const) {
  test(`${screen} centered empty state refreshes its existing authenticated API`, async ({
    page,
  }) => {
    let requests = 0;
    await page.route('**/v1/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/v1/me/conversations/unread')
        return route.fulfill({ json: { unreadCount: 0 } });
      if (path === (screen === 'partners' ? '/v1/people/available' : '/v1/me/conversations'))
        requests++;
      return route.fulfill({ json: { items: [], nextCursor: null } });
    });
    await page.goto(`/?screen=${screen}&language=en`);
    const title = page.getByRole('heading', {
      name: screen === 'partners' ? 'Partners' : 'Messages',
      exact: true,
    });
    await expect(title).toBeVisible();
    const refresh = page.getByTestId('empty-list-refresh');
    await expect(refresh).toBeVisible();
    const titleBox = await title.boundingBox();
    expect(Math.abs(titleBox!.x + titleBox!.width / 2 - 195)).toBeLessThan(1);
    const before = requests;
    await refresh.click();
    await expect.poll(() => requests).toBeGreaterThan(before);
    await capture(page, `${screen}-empty-en`);
  });
}
test('compact create preserves password and scheduled controls and uses aligned 16px back title', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-13T01:41:00Z'));
  await page.goto('/?screen=create');
  const heading = page.getByRole('heading', { name: '创建房间', exact: true });
  await expect(heading).toHaveCSS('font-size', '16px');
  await expect(page.getByText('现在开始    →    11:41 结束')).toBeVisible();
  await capture(page, 'create-zh');
  await page.getByRole('button', { name: '4 位密码', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '4 位密码', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '预约房间', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '日期', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '创建预约房间', exact: true })).toBeVisible();
  await capture(page, 'create-scheduled-password');
  await page.setViewportSize({ width: 360, height: 540 });
  await expect(page.getByRole('button', { name: '创建预约房间', exact: true })).toBeVisible();
});
test('Me omits the title and retains profile editing and language controls', async ({ page }) => {
  await page.goto('/?screen=me&language=en');
  await expect(page.getByRole('heading', { name: 'Me', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'English', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit profile', exact: true })).toBeVisible();
  await capture(page, 'me-en');
});
test('room topic stays aligned with the back arrow in the same 40px row', async ({ page }) => {
  await page.route('**/v1/rooms/visual-room/messages*', (route) =>
    route.fulfill({ json: { items: [], hasMore: false, nextCursor: null } }),
  );
  await page.goto('/?count=4&role=host');
  await expect(page.getByText('聊聊旅行中的意外收获', { exact: true })).toHaveCSS(
    'font-size',
    '16px',
  );
  await capture(page, 'room-header');
});
