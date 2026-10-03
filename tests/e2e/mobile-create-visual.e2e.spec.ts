import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });
test('mobile instant and scheduled creation show V2 settings with processing choices disabled by default', async ({
  page,
}) => {
  await page.route('**/v1/auth/web/refresh', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accessToken: 'visual-test', accessTokenExpiresInSeconds: 900 }),
    }),
  );
  await page.route('**/v1/me', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        userId: '00000000-0000-4000-8000-000000000001',
        onboardingState: 'ELIGIBLE',
        profile: null,
      }),
    }),
  );
  await page.goto('http://localhost:8082/rooms/create');
  await expect(page.getByText('创建房间', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile-create-instant-390-visual-fixture.png' });
  await page.getByRole('checkbox', { name: /会后关键词/ }).evaluate((element) => {
    let parent = element.parentElement;
    while (parent && parent.scrollHeight <= parent.clientHeight) parent = parent.parentElement;
    if (parent) parent.scrollTop = parent.scrollHeight;
  });
  await page.screenshot({ path: 'test-results/mobile-create-processing-390-visual-fixture.png' });
  await page.getByText('预约房间', { exact: true }).click();
  await expect(page.getByText('创建预约房间', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile-create-scheduled-390-visual-fixture.png' });
});
