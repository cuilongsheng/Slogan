import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });
test('My has profile editing and working account entries, and logs out before returning to login', async ({
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
  await expect(page.getByRole('button', { name: '修改资料', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '退出', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /房间历史|好友与邀请/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'English', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '中文', exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: 'docs/acceptance/main-pages-live-updates/runtime/me-real-router.png',
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

test('Edit profile loads saved values, cancels without saving and preserves optional fields on a later save', async ({
  page,
}) => {
  const actor = '00000000-0000-4000-8000-000000000001';
  let profile = {
    avatarUrl: 'http://127.0.0.1:3000/v1/avatars/default',
    displayName: 'Saved name',
    genderCode: 'prefer_not_to_say',
    nationalityCode: 'CN',
    city: '',
    birthYear: null,
    birthMonth: null,
    interestCodes: ['travel'],
    cefrLevel: 'B1_B2',
  };
  const saved: Record<string, unknown>[] = [];
  await page.route('**/v1/auth/web/refresh', (route) =>
    route.fulfill({ json: { accessToken: 'profile-fixture', accessTokenExpiresInSeconds: 900 } }),
  );
  await page.route('**/v1/me', (route) =>
    route.fulfill({ json: { userId: actor, onboardingState: 'ELIGIBLE', profile } }),
  );
  await page.route('**/v1/me/conversations/unread', (route) =>
    route.fulfill({ json: { unreadCount: 0 } }),
  );
  await page.route('**/v1/direct-calls*', (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
  await page.route('**/v1/me/profile', (route) => {
    const input = route.request().postDataJSON();
    saved.push(input);
    profile = { ...profile, ...input };
    return route.fulfill({ json: { userId: actor, onboardingState: 'ELIGIBLE', profile } });
  });
  await page.goto('http://localhost:8082/me');
  await page.getByRole('button', { name: '修改资料', exact: true }).click();
  await expect(page.getByTestId('profile-name')).toHaveValue('Saved name');
  await page.getByTestId('profile-name').fill('Discard this edit');
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await expect(page).toHaveURL(/\/me$/);
  expect(saved).toHaveLength(0);
  await page.getByRole('button', { name: '修改资料', exact: true }).click();
  await expect(page.getByTestId('profile-name')).toHaveValue('Saved name');
  await page.getByTestId('profile-name').fill('Updated name');
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await page.getByTestId('profile-submit').click();
  await expect(page).toHaveURL(/\/me$/);
  await expect(page.getByText('Updated name', { exact: true })).toBeVisible();
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({
    displayName: 'Updated name',
    nationalityCode: 'CN',
    genderCode: 'prefer_not_to_say',
    adultConfirmed: true,
  });
  expect(saved[0]).not.toHaveProperty('birthYear');
  expect(saved[0]).not.toHaveProperty('birthMonth');
});
