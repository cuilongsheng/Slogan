import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });

test('two enabled purposes require two explicit consents before device preparation', async ({ page }) => {
  await page.route('**/v1/auth/web/refresh', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'visual-test', accessTokenExpiresInSeconds: 900 }) }));
  await page.route('**/v1/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ userId: '00000000-0000-4000-8000-000000000001', onboardingState: 'ELIGIBLE', profile: null }) }));
  const roomId = '00000000-0000-4000-8000-000000000011';
  const accepted = new Set<string>();
  await page.route(`**/v1/rooms/${roomId}`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: roomId, kind: 'INSTANT', topic: '旅行英语练习', cefrLevel: 'B1', hostDisplayName: '小林', memberCount: 2, capacity: 6, endsAt: new Date(Date.now() + 60 * 60_000).toISOString(), passwordProtected: false, hostReconnectDeadline: null, sensitiveSpeechDetectionEnabled: true, postRoomKeywordsEnabled: true, visibility: 'PUBLIC', currentMembership: null, shareUrl: null }) }));
  await page.route('**/v1/me/speech-processing-consents', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: ['ROOM_SAFETY_DETECTION', 'POST_ROOM_KEYWORDS'].map((purpose) => ({ purpose, status: accepted.has(purpose) ? 'ACCEPTED' : 'REQUIRED', currentNoticeVersion: '2026-09-v1', noticeVersion: accepted.has(purpose) ? '2026-09-v1' : null, changedAt: null, providerCategory: null })) }) }));
  await page.route('**/v1/me/speech-processing-consents/*', async (route) => {
    const purpose = route.request().url().endsWith('/room-safety') ? 'ROOM_SAFETY_DETECTION' : 'POST_ROOM_KEYWORDS';
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({ action: 'ACCEPT', noticeVersion: '2026-09-v1', clientRequestId: expect.any(String) });
    accepted.add(purpose);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ purpose, status: 'ACCEPTED', currentNoticeVersion: '2026-09-v1', noticeVersion: '2026-09-v1', changedAt: new Date().toISOString(), providerCategory: null }) });
  });
  await page.goto(`http://localhost:8082/rooms/${roomId}`);
  await expect(page.getByText('会后关键词：已启用')).toBeVisible();
  await page.getByRole('button', { name: '查看入房准备' }).click();
  await expect(page.getByText('房间语音处理同意')).toBeVisible();
  await page.getByRole('checkbox', { name: /我已阅读并同意遵守房间规则/ }).click();
  await expect(page.getByRole('button', { name: '确认并继续' })).toBeDisabled();
  await page.getByRole('button', { name: '阅读并同意此目的' }).first().click();
  await expect(page.getByRole('button', { name: '确认并继续' })).toBeDisabled();
  await page.getByRole('button', { name: '阅读并同意此目的' }).click();
  await expect(page.getByRole('button', { name: '确认并继续' })).toBeEnabled();
  await page.mouse.wheel(0, 1200);
  await page.screenshot({ path: 'test-results/mobile-room-consents-390-visual-fixture.png' });
  await page.getByRole('button', { name: '确认并继续' }).click();
  await expect(page).toHaveURL(new RegExp(`/rooms/${roomId}/device$`));
});

test('privacy page revokes one future purpose without changing the other', async ({ page }) => {
  await page.route('**/v1/auth/web/refresh', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'visual-test', accessTokenExpiresInSeconds: 900 }) }));
  await page.route('**/v1/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ userId: '00000000-0000-4000-8000-000000000001', onboardingState: 'ELIGIBLE', profile: null }) }));
  const revoked = new Set<string>();
  const items = () => ['ROOM_SAFETY_DETECTION', 'POST_ROOM_KEYWORDS'].map((purpose) => ({ purpose, status: revoked.has(purpose) ? 'REVOKED' : 'ACCEPTED', currentNoticeVersion: '2026-09-v1', noticeVersion: '2026-09-v1', changedAt: new Date().toISOString(), providerCategory: null }));
  await page.route('**/v1/me/speech-processing-consents', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: items() }) }));
  await page.route('**/v1/me/speech-processing-consents/post-room-keywords', async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ action: 'REVOKE', noticeVersion: '2026-09-v1', clientRequestId: expect.any(String) });
    revoked.add('POST_ROOM_KEYWORDS');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(items()[1]) });
  });
  await page.goto('http://localhost:8082/me/room-processing');
  await expect(page.getByRole('button', { name: '撤回未来处理同意' })).toHaveCount(2);
  await page.getByRole('button', { name: '撤回未来处理同意' }).nth(1).click();
  await expect(page.getByText('已撤回')).toBeVisible();
  await expect(page.getByRole('button', { name: '撤回未来处理同意' })).toHaveCount(1);
  await expect(page.getByText('撤回只影响未来处理，不会删除历史审计记录或已经产生的安全案件。')).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile-room-privacy-390-visual-fixture.png' });
});
