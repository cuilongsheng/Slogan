import { expect, test, type Page } from '@playwright/test';
import { mockRoomEntry, entryRoomId } from '../fixtures/mobile-room-entry';
const origin = process.env.SLOGAN_MOBILE_E2E_ORIGIN ?? 'http://localhost:8082';
test.use({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });
const output = 'docs/acceptance/invitation-report-feedback/runtime';
const invitation = {
  id: '00000000-0000-4000-8000-000000000041',
  roomId: entryRoomId,
  inviterUserId: 'host',
  inviteeUserId: 'receiver',
  inviterDisplayName: 'Luna',
  status: 'PENDING',
  createdAt: '2026-10-13T00:00:00Z',
  room: {
    topic: '聊聊旅行中的意外收获',
    status: 'OPEN',
    cefrLevel: 'B1',
    passwordProtected: true,
    endsAt: '2099-01-01T00:00:00Z',
    startedAt: '2026-10-13T00:00:00Z',
  },
};
async function main(page: Page, user = 'receiver') {
  await page.addInitScript(() => localStorage.setItem('slogan.locale.v1', 'zh'));
  await page.route('**/v1/**', (route) =>
    route.fulfill({ status: 200, json: { items: [], nextCursor: null } }),
  );
  await page.route('**/v1/auth/web/refresh', (route) =>
    route.fulfill({ json: { accessToken: 'fixture-only', accessTokenExpiresInSeconds: 900 } }),
  );
  await page.route('**/v1/me', (route) =>
    route.fulfill({
      json: { userId: user, onboardingState: 'ELIGIBLE', profile: { displayName: 'Preview A' } },
    }),
  );
  await page.route('**/v1/me/conversations/unread', (route) =>
    route.fulfill({ json: { unreadCount: 0 } }),
  );
}
test('two independent pages receive only their own invites; later/reopen, decline and direct password admission work', async ({
  browser,
}) => {
  const host = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    receiver = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const senderPage = await host.newPage(),
    page = await receiver.newPage();
  let pending = true;
  const declines: object[] = [];
  try {
    await main(senderPage, 'host');
    await main(page);
    const entry = await mockRoomEntry(page, { password: true });
    await page.route('**/v1/me/room-invitations*', (route) =>
      route.fulfill({ json: { items: pending ? [invitation] : [], nextCursor: null } }),
    );
    await page.route(`**/v1/room-invitations/${invitation.id}/decline`, (route) => {
      declines.push(route.request().postDataJSON());
      pending = false;
      return route.fulfill({ json: {} });
    });
    await senderPage.goto(`${origin}/partners`);
    await page.goto(`${origin}/partners`);
    await expect(senderPage.getByTestId('incoming-room-invitation')).toHaveCount(0);
    await expect(page.getByTestId('incoming-room-invitation')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(() =>
        page.getByTestId('incoming-room-invitation').evaluate((node) => {
          let min = 1;
          for (let p: Element | null = node; p; p = p.parentElement)
            min = Math.min(min, Number(getComputedStyle(p).opacity));
          return min;
        }),
      )
      .toBe(1);
    await page.screenshot({ path: `${output}/incoming.png` });
    await page.getByRole('button', { name: '稍后', exact: true }).last().click();
    await page.getByRole('button', { name: '房间邀请 · 1', exact: true }).click();
    await page.getByRole('button', { name: '拒绝', exact: true }).click();
    await expect(page.getByTestId('incoming-room-invitation')).toHaveCount(0);
    expect(declines).toHaveLength(1);
    pending = true;
    await page.reload();
    await page.getByRole('button', { name: '加入房间', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/rooms/${entryRoomId}/session`));
    await expect(page.getByLabel('4 位密码', { exact: true })).toBeVisible();
    await page.getByLabel('4 位密码', { exact: true }).fill('1234');
    await page.getByRole('button', { name: '进入语音房', exact: true }).click();
    await expect.poll(() => entry.joins.length).toBe(2);
    expect(entry.joins.at(-1)).toMatchObject({
      invitationId: invitation.id,
      password: '1234',
      rulesAccepted: true,
    });
  } finally {
    await host.close();
    await receiver.close();
  }
});
test('Me keeps compact profile and language without a title; logout is 342×46 and history refresh keeps current progress', async ({
  page,
}) => {
  await main(page);
  let status = 'OPEN';
  const report = {
    id: 'report-1',
    caseId: '9dd35a27-188a-45db-94bc-eee121231212',
    kind: 'ROOM',
    roomTopic: '聊聊旅行中的意外收获',
    category: 'HARASSMENT_ABUSE',
    status,
    submittedAt: '2026-10-13T06:00:00Z',
    updatedAt: '2026-10-13T06:00:00Z',
    decidedAt: null,
  };
  await page.route('**/v1/me/reports*', (route) =>
    route.fulfill({ json: { items: [{ ...report, status }], nextCursor: null } }),
  );
  await page.goto(`${origin}/me`);
  await expect(page.getByRole('heading', { name: '我的', exact: true })).toHaveCount(0);
  await expect(page.getByText('Preview A', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '中文', exact: true })).toBeVisible();
  expect(await page.getByRole('button', { name: '中文', exact: true }).boundingBox()).toMatchObject(
    { height: 18 },
  );
  const logout = page.getByRole('button', { name: '退出', exact: true });
  expect(await logout.boundingBox()).toMatchObject({ x: 24, width: 342, height: 46 });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${output}/me.png` });
  await page.getByRole('button', { name: '我的投诉', exact: true }).click();
  await expect(page.getByText('已收到', { exact: true })).toBeVisible();
  status = 'UNDER_REVIEW';
  await page.getByRole('button', { name: '刷新', exact: true }).click();
  await expect(page.getByText('审核中', { exact: true })).toBeVisible();
  await page.screenshot({ path: `${output}/history.png` });
  await page.route('**/v1/me/reports*', (route) => route.fulfill({ status: 503, json: {} }));
  await page.getByRole('button', { name: '刷新', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('审核中', { exact: true })).toBeVisible();
});
test('main headings are 16px and Discover toolbar follows the newest positioning; full page actions share 342×46', async ({
  page,
}) => {
  await main(page);
  for (const [path, title] of [
    ['partners', '找伙伴'],
    ['messages', '消息'],
  ]) {
    await page.goto(`${origin}/${path}`);
    await expect(page.getByRole('heading', { name: title, exact: true })).toHaveCSS(
      'font-size',
      '16px',
    );
    await page.screenshot({ path: `${output}/${path}.png` });
  }
  await page.goto(`${origin}/rooms`);
  await expect(page.getByRole('button', { name: '创建房间', exact: true })).toBeVisible();
  await page.screenshot({ path: `${output}/discover.png` });
  await page.goto(`${origin}/rooms/create`);
  const create = page.getByRole('button', { name: '创建并开放房间', exact: true });
  expect(await create.boundingBox()).toMatchObject({ x: 24, width: 342, height: 46 });
  await page.screenshot({ path: `${output}/create.png` });
});
