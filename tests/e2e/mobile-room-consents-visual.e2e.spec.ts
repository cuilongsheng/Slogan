import { expect, test } from '@playwright/test';
import { entryRoomId, mobileOrigin, mockRoomEntry } from '../fixtures/mobile-room-entry';

test.use({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });

test('missing speech purposes are explicitly accepted in the direct entry state', async ({
  page,
}) => {
  const { joins, consentCommands } = await mockRoomEntry(page, { processing: true });
  await page.goto(`${mobileOrigin}/rooms`);
  await page.getByText('旅行英语练习').click();
  await expect(page).toHaveURL(new RegExp(`/rooms/${entryRoomId}/session$`));
  await expect(page.getByText('房间语音处理同意')).toBeVisible();
  expect(consentCommands).toEqual([]);
  await expect(page.getByRole('button', { name: '重试', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '阅读并同意此目的' }).first().click();
  await expect.poll(() => consentCommands.length).toBe(1);
  await expect(page.getByRole('button', { name: '重试', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '阅读并同意此目的' }).click();
  await expect(page.getByRole('button', { name: '重试', exact: true })).toBeEnabled();
  await page.screenshot({
    path: 'docs/acceptance/simplify-direct-room-entry/consents-runtime-web-fixture.png',
  });
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect.poll(() => joins.length).toBe(2);
  expect(consentCommands).toHaveLength(2);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
});

test('privacy page revokes one future purpose without changing the other', async ({ page }) => {
  await page.route('**/v1/auth/web/refresh', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accessToken: 'visual-test', accessTokenExpiresInSeconds: 900 }),
    }),
  );
  await page.route('**/v1/me', (route) =>
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
  const revoked = new Set<string>();
  const items = () =>
    ['ROOM_SAFETY_DETECTION', 'POST_ROOM_KEYWORDS'].map((purpose) => ({
      purpose,
      status: revoked.has(purpose) ? 'REVOKED' : 'ACCEPTED',
      currentNoticeVersion: '2026-09-v1',
      noticeVersion: '2026-09-v1',
      changedAt: new Date().toISOString(),
      providerCategory: null,
    }));
  await page.route('**/v1/me/speech-processing-consents', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: items() }),
    }),
  );
  await page.route('**/v1/me/speech-processing-consents/post-room-keywords', async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      action: 'REVOKE',
      noticeVersion: '2026-09-v1',
      clientRequestId: expect.any(String),
    });
    revoked.add('POST_ROOM_KEYWORDS');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(items()[1]),
    });
  });
  await page.goto(`${mobileOrigin}/me/room-processing`);
  await expect(page.getByRole('button', { name: '撤回未来处理同意' })).toHaveCount(2);
  await page.getByRole('button', { name: '撤回未来处理同意' }).nth(1).click();
  await expect(page.getByText('已撤回')).toBeVisible();
  await expect(page.getByRole('button', { name: '撤回未来处理同意' })).toHaveCount(1);
  await expect(
    page.getByText('撤回只影响未来处理，不会删除历史审计记录或已经产生的安全案件。'),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile-room-privacy-390-visual-fixture.png' });
});
