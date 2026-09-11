import { expect, test } from '@playwright/test';

test('admin bootstrap loads without browser errors', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserErrors.push(message.text());
    }
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Slogan Admin is ready' })).toBeVisible();
  await expect(page.getByText(/not a product dashboard/i)).toBeVisible();
  expect(browserErrors).toEqual([]);
});
