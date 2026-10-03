import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });

test('personal history distinguishes reservation, opens an eligible private note, and saves a version', async ({ page }) => {
  await page.route('**/v1/auth/web/refresh', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'visual-test', accessTokenExpiresInSeconds: 900 }) }));
  await page.route('**/v1/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ userId: '00000000-0000-4000-8000-000000000001', onboardingState: 'ELIGIBLE', profile: null }) }));
  const participantId = '00000000-0000-4000-8000-000000000011';
  const reservationId = '00000000-0000-4000-8000-000000000012';
  const occurredAt = '2026-09-27T08:00:00.000Z';
  await page.route('**/v1/me/room-history*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [
    { roomId: participantId, kind: 'INSTANT', topic: '在咖啡馆聊旅行计划', cefrLevel: 'A2', status: 'ENDED', startedAt: occurredAt, endsAt: occurredAt, occurredAt, relationship: 'PARTICIPATED', membershipLifecycle: 'LEFT', membershipRole: 'MEMBER', reservationStatus: null, noteExists: false },
    { roomId: reservationId, kind: 'APPOINTMENT', topic: '周末英语练习', cefrLevel: 'B1', status: 'ENDED', startedAt: occurredAt, endsAt: occurredAt, occurredAt, relationship: 'RESERVED_ONLY', membershipLifecycle: null, membershipRole: null, reservationStatus: 'CONFIRMED', noteExists: false },
  ], nextCursor: null }) }));
  let version = 0;
  let content: string | null = null;
  await page.route('**/v1/rooms/*/note', async (route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON();
      expect(body).toMatchObject({ content: '今天学会了讨论旅行计划。', expectedVersion: 0 });
      version = 1;
      content = body.content;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content, version, updatedAt: content ? '2026-09-28T08:00:00.000Z' : null }) });
  });
  await page.goto('http://localhost:8082/me');
  await page.getByRole('button', { name: /房间历史/ }).click();
  await expect(page.getByText('仅预约 · 预约房间 · B1')).toBeVisible();
  await expect(page.getByRole('button', { name: /写私人笔记/ })).toHaveCount(1);
  await page.screenshot({ path: 'test-results/mobile-history-390-visual-fixture.png' });
  await page.getByRole('button', { name: /写私人笔记/ }).click();
  await expect(page.getByRole('textbox', { name: '笔记内容' })).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile-note-390-visual-fixture.png' });
  await page.getByRole('textbox', { name: '笔记内容' }).fill('今天学会了讨论旅行计划。');
  await page.getByRole('button', { name: '保存笔记' }).click();
  await expect(page.getByText('已保存')).toBeVisible();
  expect(version).toBe(1);
});
