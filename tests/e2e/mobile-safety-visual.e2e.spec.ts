import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });

async function signedIn(page: import('@playwright/test').Page) {
  await page.route('**/v1/auth/web/refresh', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'visual-test', accessTokenExpiresInSeconds: 900 }) }));
  await page.route('**/v1/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ userId: '00000000-0000-4000-8000-000000000001', onboardingState: 'ELIGIBLE', profile: null }) }));
}

test('mobile personal safety page renders empty and active restriction states', async ({ page }) => {
  await signedIn(page);
  const startsAt = new Date(Date.now() - 5 * 60_000).toISOString();
  const appealDeadlineAt = new Date(Date.now() + 25 * 60_000).toISOString();
  const endsAt = new Date(Date.now() + 3 * 60 * 60_000).toISOString();
  let item: Record<string, unknown> | null = null;
  const submitted: Array<Record<string, unknown>> = [];
  await page.route('**/v1/me/safety-restrictions/*/appeal', async (route) => {
    submitted.push(route.request().postDataJSON());
    item = { ...item, appealStatus: 'PENDING' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: '00000000-0000-4000-8000-000000000099', restrictionId: '00000000-0000-4000-8000-000000000011', userId: '00000000-0000-4000-8000-000000000001', status: 'PENDING', reason: '请复核此限制', submittedAt: new Date().toISOString(), decidedAt: null, decidedByUserId: null, decisionReason: null }) });
  });
  await page.route('**/v1/me/safety-restrictions*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: item ? [item] : [], nextCursor: null }) });
  });
  await page.goto('http://localhost:8082/me');
  await expect(page.getByText('我的限制与申诉')).toBeVisible();
  await page.getByRole('button', { name: /我的限制与申诉/ }).click();
  await expect(page.getByText('暂无限制记录')).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile-safety-empty-390-visual-fixture.png' });
  item = { id: '00000000-0000-4000-8000-000000000011', severity: 'GENERAL', reason: '请查看社区规则并暂停加入语音房间。', startsAt, endsAt, appealDeadlineAt, status: 'ACTIVE', appealStatus: null };
  await page.reload();
  await expect(page.getByRole('button', { name: '提交申诉' })).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile-safety-active-390-visual-fixture.png' });
  await page.getByRole('button', { name: '提交申诉' }).click();
  await page.getByRole('textbox', { name: '申诉理由' }).fill('请复核此限制');
  await page.getByRole('button', { name: '确认提交申诉' }).click();
  await expect(page.getByText('申诉处理中')).toBeVisible();
  expect(submitted).toHaveLength(1);
  expect(submitted[0]).toMatchObject({ reason: '请复核此限制', clientRequestId: expect.any(String) });
});
