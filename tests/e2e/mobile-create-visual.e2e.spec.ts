import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });
test('mobile instant and scheduled creation show V2 settings with processing choices disabled by default', async ({
  page,
}) => {
  await page.route('**/v1/auth/web/refresh', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accessToken: 'visual-test', accessTokenExpiresInSeconds: 900 }),
    }),
  );
  await page.route('**/v1/me', async (route) =>
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
  await page.goto('http://localhost:8082/rooms/create');
  await expect(page.getByText('创建房间', { exact: true })).toBeVisible();
  await expect(page.getByText('最低等级', { exact: true })).toBeVisible();
  await expect(page.getByText('最高等级', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'B1', exact: true })).toHaveCount(2);
  await expect(page.getByText('B1–B2', { exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: 'docs/acceptance/simplify-room-and-mobile-experience/create-runtime-fixture.png',
  });
  await page.getByRole('checkbox', { name: /会后关键词/ }).evaluate((element) => {
    let parent = element.parentElement;
    while (parent && parent.scrollHeight <= parent.clientHeight) parent = parent.parentElement;
    if (parent) parent.scrollTop = parent.scrollHeight;
  });
  await page.screenshot({
    path: 'docs/acceptance/simplify-room-and-mobile-experience/create-processing-runtime-fixture.png',
  });
  await page.getByText('预约房间', { exact: true }).click();
  await expect(page.getByText('创建预约房间', { exact: true })).toBeVisible();
  await page.screenshot({
    path: 'docs/acceptance/simplify-room-and-mobile-experience/create-scheduled-runtime-fixture.png',
  });
});

test('direct level boundaries are submitted for both room kinds and retained in appointment detail', async ({
  page,
}) => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const roomId = '00000000-0000-4000-8000-000000000022';
  const submissions: Array<Record<string, unknown>> = [];
  await page.route('**/v1/auth/web/refresh', (route) =>
    route.fulfill({ json: { accessToken: 'fixture', accessTokenExpiresInSeconds: 900 } }),
  );
  await page.route('**/v1/me', (route) =>
    route.fulfill({ json: { userId, onboardingState: 'ELIGIBLE', profile: null } }),
  );
  await page.route('**/v1/rooms', (route) => {
    submissions.push(route.request().postDataJSON());
    return route.fulfill({ status: 201, json: { id: roomId } });
  });
  let appointment: Record<string, unknown> = {};
  await page.route('**/v1/appointment-rooms', (route) => {
    const input = route.request().postDataJSON();
    submissions.push(input);
    appointment = {
      ...input,
      id: roomId,
      hostUserId: userId,
      status: 'SCHEDULED',
      memberCount: 0,
      reservedCount: 0,
      availableCount: 4,
      reservation: null,
      passwordProtected: false,
      shareUrl: 'https://slogan-preview-mobile.pages.dev/share/fixture',
    };
    return route.fulfill({ status: 201, json: appointment });
  });
  await page.route(`**/v1/appointment-rooms/${roomId}`, (route) =>
    route.fulfill({ json: appointment }),
  );
  await page.goto('http://localhost:8082/rooms/create');
  await page.getByRole('textbox', { name: '房间主题', exact: true }).fill('旅行英语练习');
  await page.getByRole('button', { name: 'C1', exact: true }).first().click();
  await expect(page.getByText('C1', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'B1', exact: true }).first().click();
  await page.getByRole('button', { name: 'B2', exact: true }).last().click();
  await expect(page.getByText('B1–B2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '创建并开放房间' }).click();
  await expect(page).toHaveURL(new RegExp(`/rooms/${roomId}/session`));
  expect(submissions[0]).toMatchObject({
    cefrLevel: 'B1',
    cefrLevelMin: 'B1',
    cefrLevelMax: 'B2',
    sensitiveSpeechDetectionEnabled: false,
    postRoomKeywordsEnabled: false,
  });
  await page.goto('http://localhost:8082/rooms/create');
  await page.getByRole('textbox', { name: '房间主题', exact: true }).fill('预约旅行练习');
  await page.getByText('预约房间', { exact: true }).click();
  const tomorrow = new Date(Date.now() + 86400000);
  const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  await page.getByRole('textbox', { name: '日期', exact: true }).fill(date);
  await page.getByRole('button', { name: '创建预约房间', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/rooms/appointments/${roomId}`));
  await expect(page.getByText('B1–B2', { exact: true })).toBeVisible();
  expect(submissions[1]).toMatchObject({ cefrLevel: 'B1', cefrLevelMin: 'B1', cefrLevelMax: 'B2' });
});
