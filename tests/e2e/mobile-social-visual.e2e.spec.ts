import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });

test('friends, available people and received room invitation are reachable', async ({ page }) => {
  await page.route('**/v1/auth/web/refresh', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'visual-test', accessTokenExpiresInSeconds: 900 }) }));
  await page.route('**/v1/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ userId: '00000000-0000-4000-8000-000000000001', onboardingState: 'ELIGIBLE', profile: null }) }));
  await page.route('**/v1/me/presence/heartbeat', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ expiresAt: '2026-09-28T15:00:00.000Z', refreshAfterSeconds: 60 }) }));
  const friendId = '00000000-0000-4000-8000-000000000011';
  const availableId = '00000000-0000-4000-8000-000000000012';
  const roomId = '00000000-0000-4000-8000-000000000013';
  const invitationId = '00000000-0000-4000-8000-000000000014';
  await page.route('**/v1/me/friends*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ id: '00000000-0000-4000-8000-000000000015', friend: { userId: friendId, displayName: '小林', avatarUrl: 'https://example.com/avatar.png', cefrLevel: 'B1', nationalityCode: null, city: null, interestCodes: [] }, isAvailable: true, createdAt: '2026-09-27T00:00:00.000Z' }], nextCursor: null }) }));
  await page.route('**/v1/people/available*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ userId: availableId, displayName: 'Alex', avatarUrl: 'https://example.com/avatar.png', cefrLevel: 'A2', nationalityCode: null, city: null, interestCodes: [], isAvailable: true }], nextCursor: null }) }));
  await page.route('**/v1/friend-requests*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: route.request().url().includes('direction=incoming') ? [{ id: '00000000-0000-4000-8000-000000000016', requesterUserId: availableId, recipientUserId: '00000000-0000-4000-8000-000000000001', peerDisplayName: 'Alex', status: 'PENDING', createdAt: '2026-09-28T08:00:00.000Z', resolvedAt: null }] : [], nextCursor: null }) }));
  await page.route('**/v1/blocks*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], nextCursor: null }) }));
  await page.route('**/v1/me/room-invitations*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ id: invitationId, roomId, inviterUserId: friendId, inviteeUserId: '00000000-0000-4000-8000-000000000001', status: 'PENDING', createdAt: '2026-09-28T08:00:00.000Z', resolvedAt: null, inviterDisplayName: '小林', room: { topic: '一起练习旅行英语', cefrLevel: 'B1', status: 'OPEN', startedAt: '2026-09-28T08:00:00.000Z', endsAt: '2026-09-28T10:00:00.000Z', passwordProtected: false } }], nextCursor: null }) }));
  await page.goto('http://localhost:8082/me');
  await page.getByRole('button', { name: /好友与邀请/ }).click();
  await expect(page.getByText('小林')).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile-social-friends-390-visual-fixture.png' });
  await page.getByRole('button', { name: '可邀请' }).click();
  await expect(page.getByText('Alex')).toBeVisible();
  await page.getByRole('button', { name: '收到的请求' }).click();
  await expect(page.getByText('Alex')).toBeVisible();
  await page.getByRole('button', { name: '房间邀请' }).click();
  await expect(page.getByText('一起练习旅行英语')).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile-social-invitations-390-visual-fixture.png' });
  await page.getByRole('button', { name: '查看房间' }).click();
  await expect(page).toHaveURL(new RegExp(`/rooms/${roomId}\\?invitationId=${invitationId}`));
});
