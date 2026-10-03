import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });

test('post-room summary and private vocabulary work in the mobile web viewport', async ({ page }) => {
  await page.route('**/v1/auth/web/refresh', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'visual-test', accessTokenExpiresInSeconds: 900 }) }));
  await page.route('**/v1/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ userId: '00000000-0000-4000-8000-000000000001', onboardingState: 'ELIGIBLE', profile: null }) }));
  const roomId = '00000000-0000-4000-8000-000000000011';
  const summaryItemId = '00000000-0000-4000-8000-000000000012';
  let privateItem: Record<string, unknown> | null = null;
  let importRequestId: string | null = null;
  await page.route('**/v1/me/room-history*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ roomId, kind: 'INSTANT', topic: '在咖啡馆聊旅行计划', cefrLevel: 'A2', status: 'ENDED', startedAt: '2026-09-27T08:00:00.000Z', endsAt: '2026-09-27T08:00:00.000Z', occurredAt: '2026-09-27T08:00:00.000Z', relationship: 'PARTICIPATED', membershipLifecycle: 'LEFT', membershipRole: 'MEMBER', reservationStatus: null, noteExists: false }], nextCursor: null }) }));
  await page.route('**/v1/rooms/*/keyword-summary', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ roomId, topic: '在咖啡馆聊旅行计划', status: 'READY', generatedAt: '2026-09-27T08:01:00.000Z', items: [{ id: summaryItemId, kind: 'KEYWORD', text: 'itinerary', rank: 1 }, { id: '00000000-0000-4000-8000-000000000013', kind: 'EXPRESSION', text: 'Could you recommend a place to visit?', rank: 2 }] }) }));
  await page.route('**/v1/me/vocabulary-items*', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      const body = request.postDataJSON();
      expect(body.sourceSummaryItemId).toBe(summaryItemId);
      importRequestId = body.clientRequestId;
      privateItem = { id: '00000000-0000-4000-8000-000000000021', kind: 'KEYWORD', text: 'itinerary', note: null, favorite: false, version: 1, createdAt: '2026-09-27T08:02:00.000Z', updatedAt: '2026-09-27T08:02:00.000Z' };
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(privateItem) });
    } else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: privateItem ? [privateItem] : [], nextCursor: null }) });
  });
  await page.route('**/v1/me/vocabulary-items/*', async (route) => {
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({ expectedVersion: 1, favorite: true });
    privateItem = { ...privateItem, favorite: true, version: 2 };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(privateItem) });
  });
  await page.goto('http://localhost:8082/me/history');
  await page.getByRole('button', { name: /查看会后关键词/ }).click();
  await expect(page.getByText('itinerary')).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile-keywords-390-visual-fixture.png' });
  await page.getByRole('button', { name: '加入我的词汇' }).first().click();
  await expect(page.getByText('已加入')).toBeVisible();
  expect(importRequestId).toMatch(/^[0-9a-f-]{36}$/);
  await page.goto('http://localhost:8082/me/vocabulary');
  await expect(page.getByText('itinerary')).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile-vocabulary-390-visual-fixture.png' });
  await page.getByRole('button', { name: '收藏', exact: true }).click();
  await expect(page.getByRole('button', { name: '取消收藏' })).toBeVisible();
});
