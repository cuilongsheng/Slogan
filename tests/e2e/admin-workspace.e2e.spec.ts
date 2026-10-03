import { expect, test } from '@playwright/test';

test('guest is redirected to an actionable admin sign-in page', async ({ page }) => {
  await page.goto('/rooms');
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole('heading', { name: '登录管理后台' })).toBeVisible();
  await expect(page.getByRole('button', { name: /使用 Google 登录/ })).toBeEnabled();
});

test('auditor can read audit but cannot open role management', async ({ page }) => {
  await page.route('**/v1/auth/web/refresh', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accessToken: 'test-access', accessTokenExpiresInSeconds: 900 }),
    }),
  );
  await page.route('**/v1/backoffice/me', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ userId: '00000000-0000-4000-8000-000000000001', roles: ['AUDITOR'] }),
    }),
  );
  await page.route('**/v1/backoffice/audit-events*', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], nextCursor: null }),
    }),
  );
  await page.goto('/audit');
  await expect(page.getByRole('heading', { name: '操作审计' })).toBeVisible();
  await expect(page.getByText('暂无记录')).toBeVisible();
  await page.goto('/roles');
  await expect(page.getByRole('alert')).toHaveText('当前账号无权查看此内容');
});

test('role revocation requires explicit confirmation', async ({ page }) => {
  let revokeCalls = 0;
  await page.route('**/v1/auth/web/refresh', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accessToken: 'test-access', accessTokenExpiresInSeconds: 900 }),
    }),
  );
  await page.route('**/v1/backoffice/me', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        userId: '00000000-0000-4000-8000-000000000001',
        roles: ['PLATFORM_ADMIN'],
      }),
    }),
  );
  await page.route('**/v1/backoffice/role-assignments*', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: '00000000-0000-4000-8000-000000000002',
            userId: '00000000-0000-4000-8000-000000000003',
            role: 'AUDITOR',
            active: true,
            grantedAt: '2026-09-28T00:00:00.000Z',
            revokedAt: null,
            version: 1,
          },
        ],
        nextCursor: null,
      }),
    }),
  );
  await page.route('**/v1/backoffice/users/*/roles/*/revoke', async (route) => {
    revokeCalls += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/roles');
  await expect(page.getByRole('heading', { name: '后台角色' })).toBeVisible();
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '确认敏感操作' })).toBeVisible();
  await page.getByRole('button', { name: '取消' }).click();
  expect(revokeCalls).toBe(0);
});
