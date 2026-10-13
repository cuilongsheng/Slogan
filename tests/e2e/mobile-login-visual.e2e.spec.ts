import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });

test('branded restoration gates entry, then the simplified login preserves recovery and social actions', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('slogan.locale.v1', 'zh'));
  let resolveRestore!: () => void;
  const restore = new Promise<void>((resolve) => {
    resolveRestore = resolve;
  });
  let requests = 0;
  await page.route('**/v1/auth/web/refresh', async (route) => {
    requests++;
    await restore;
    await route.fulfill({ status: 401, json: { code: 'AUTH_REQUIRED' } });
  });
  await page.goto('http://localhost:8082/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('brand-loading')).toBeVisible();
  await expect(page.getByTestId('login-username')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'docs/acceptance/mobile-ui-v3/runtime/loading.png' });
  expect(requests).toBe(1);
  resolveRestore();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByTestId('brand-loading')).toHaveCount(0);
  await expect(page.getByTestId('google-sign-in')).toBeEnabled();
  await expect(page.getByTestId('wechat-sign-in')).toBeDisabled();
  await expect(page.getByText('Open Your Mouth')).toHaveCount(0);
  const username = page.getByTestId('login-username');
  await expect(username).toHaveAttribute('placeholder', '输入用户名');
  const password = page.getByTestId('login-password');
  await expect(password).toHaveAttribute('placeholder', '输入密码');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'docs/acceptance/mobile-ui-v3/runtime/login-zh.png' });
  await page.getByRole('button', { name: '忘记密码？', exact: true }).click();
  await expect(page).toHaveURL(/\/email\/forgot$/);
});
