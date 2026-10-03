import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });

test('Google login remains enabled on the approved mobile login layout', async ({ page }) => {
  await page.goto('http://localhost:8082/sign-in');
  const google = page.getByTestId('google-sign-in');
  await expect(google).toBeVisible();
  await expect(google).toBeEnabled();
  await expect(page.getByText('Open Your Mouth')).toBeVisible();
  const hero = await page.getByText('Open Your Mouth').locator('..').boundingBox();
  const passwordButton = await page.getByTestId('password-sign-in').boundingBox();
  const googleButton = await google.boundingBox();
  expect(hero?.y).toBeGreaterThanOrEqual(244);
  expect(hero?.y).toBeLessThanOrEqual(246);
  expect(passwordButton?.y).toBeGreaterThanOrEqual(640);
  expect(passwordButton?.y).toBeLessThanOrEqual(642);
  expect(googleButton?.y).toBeGreaterThanOrEqual(747);
  expect(googleButton?.y).toBeLessThanOrEqual(751);
  await page.screenshot({ path: 'test-results/mobile-login-390-visual.png', fullPage: true });
});
