import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });
test('My has exactly three working entries and calls logout before returning to login', async ({
  page,
}) => {
  let signedOut = false;
  await page.route('**/v1/auth/web/refresh', (route) =>
    route.fulfill({
      status: signedOut ? 401 : 200,
      json: signedOut ? {} : { accessToken: 'visual-test', accessTokenExpiresInSeconds: 900 },
    }),
  );
  await page.route('**/v1/me', (route) =>
    route.fulfill({
      json: {
        userId: '00000000-0000-4000-8000-000000000001',
        onboardingState: 'ELIGIBLE',
        profile: null,
      },
    }),
  );
  await page.route('**/v1/auth/capabilities', (route) =>
    route.fulfill({
      json: { previewPasswordLogin: true, googleLogin: false, emailPasswordLogin: false },
    }),
  );
  await page.route('**/v1/auth/web/logout', (route) => {
    signedOut = true;
    return route.fulfill({ json: {} });
  });
  await page.goto('http://localhost:8082/me');
  await expect(page.getByRole('button', { name: '我的限制与申诉' })).toBeVisible();
  await expect(page.getByRole('button', { name: '我的词汇' })).toBeVisible();
  await expect(page.getByRole('button', { name: '退出', exact: true })).toBeVisible();
  await expect(page.getByRole('button')).toHaveCount(4); // Three entries and back.
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: 'docs/acceptance/simplify-room-and-mobile-experience/me-runtime-fixture.png',
  });
  await page.getByRole('button', { name: '我的限制与申诉' }).click();
  await expect(page).toHaveURL(/\/me\/restrictions/);
  await page.goto('http://localhost:8082/me');
  await page.getByRole('button', { name: '我的词汇' }).click();
  await expect(page).toHaveURL(/\/me\/vocabulary/);
  await page.goto('http://localhost:8082/me');
  await page.getByRole('button', { name: '退出', exact: true }).click();
  await expect.poll(() => signedOut).toBe(true);
  await expect(page).toHaveURL(/\/sign-in/);
});
