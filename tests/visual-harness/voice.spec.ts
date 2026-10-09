import { expect, test } from '@playwright/test';

test('real voice component sends text and renders hold/release English using explicit adapters', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-09-28T09:00:00Z'));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const messages = [
    {
      id: 'fixture-message',
      sequence: '1',
      senderUserId: 'user-0',
      senderDisplayName: '系统',
      text: 'Mika 刚刚加入房间',
      createdAt: '2026-09-28T09:00:00Z',
    },
  ];
  await page.route('**/v1/rooms/visual-room/messages*', (route) => {
    if (route.request().method() === 'POST') {
      const input = route.request().postDataJSON();
      expect(input.text).toBe('Hello room');
      const result = { ...messages[0], id: 'sent', sequence: '2', text: input.text };
      messages.push(result);
      return route.fulfill({ json: result });
    }
    return route.fulfill({
      json: { items: messages, nextCursor: 'fixture-cursor', hasMore: false },
    });
  });
  let consentStatus = 'ACCEPTED';
  await page.route('**/v1/me/speech-processing-consents', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            purpose: 'AI_EXPRESSION_AUDIO',
            status: consentStatus,
            currentNoticeVersion: 'fixture-v2',
          },
        ],
      },
    }),
  );
  await page.route('**/v1/me/speech-processing-consents/ai-expression', (route) => {
    expect(route.request().postDataJSON().action).toBe('ACCEPT');
    consentStatus = 'ACCEPTED';
    return route.fulfill({
      json: {
        purpose: 'AI_EXPRESSION_AUDIO',
        status: 'ACCEPTED',
        currentNoticeVersion: 'fixture-v2',
      },
    });
  });
  let audioSubmitted = false;
  await page.route('**/v1/rooms/visual-room/expression-assistance/audio', (route) => {
    audioSubmitted = true;
    return route.fulfill({
      json: { primary: { text: 'I missed the train, but the detour led me to a great café.' } },
    });
  });
  await page.goto('/?role=host');
  await expect(page.getByText('聊聊旅行中的意外收获')).toBeVisible();
  await expect(page.getByText('Mika 刚刚加入房间')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: 'docs/acceptance/simplify-room-and-mobile-experience/voice-runtime-component-fixture.png',
  });
  await page.getByRole('textbox').fill('Hello room');
  await page.getByRole('button', { name: '发送消息' }).click();
  await expect(page.getByText('Hello room', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '用母语找英文表达 · 仅自己可见' }).click();
  await expect(page.getByRole('button', { name: '按着开始说' })).toBeVisible();
  await page.screenshot({
    path: 'docs/acceptance/simplify-room-and-mobile-experience/translation-hold-runtime-component-fixture.png',
  });
  const mic = page.getByRole('button', { name: '按着开始说' });
  await mic.hover();
  await page.mouse.down();
  await expect(page.getByText('00:00 / 00:10')).toBeVisible();
  expect(audioSubmitted).toBe(false);
  await page.mouse.up();
  await expect(
    page.getByText('I missed the train, but the detour led me to a great café.'),
  ).toBeVisible();
  await page.screenshot({
    path: 'docs/acceptance/simplify-room-and-mobile-experience/translation-result-runtime-component-fixture.png',
  });
  expect(audioSubmitted).toBe(true);
  await page.getByRole('button', { name: '关闭' }).click();
  await page.goto('/?role=host');
  await expect(page.getByText('聊聊旅行中的意外收获')).toBeVisible();
  await page.getByRole('button', { name: '退出房间', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mika', exact: true }).last()).toBeVisible();
  await page.screenshot({
    path: 'docs/acceptance/simplify-room-and-mobile-experience/host-handoff-runtime-component-fixture.png',
  });
  const transfer = page.getByRole('button', { name: '移交房主并退出', exact: true });
  await expect(transfer).toBeDisabled();
  await page.getByRole('button', { name: 'Mika', exact: true }).last().click();
  await expect(transfer).toBeEnabled();
  await page.screenshot({
    path: 'docs/acceptance/simplify-room-and-mobile-experience/host-handoff-selected-runtime-component-fixture.png',
  });
  await page.getByRole('button', { name: '关闭' }).click();
  consentStatus = 'REQUIRED';
  await page.getByRole('button', { name: '用母语找英文表达 · 仅自己可见' }).click();
  await expect(page.getByRole('button', { name: '同意并继续' })).toBeVisible();
  await page.screenshot({
    path: 'docs/acceptance/simplify-room-and-mobile-experience/translation-consent-runtime-component-fixture.png',
  });
  await page.getByRole('button', { name: '同意并继续' }).click();
  await expect(page.getByRole('button', { name: '按着开始说' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('creation uses only three visible ranges and submits the selected pair without hidden processing', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let created = false;
  await page.route('**/v1/rooms', (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      topic: '周末旅行',
      cefrLevelMin: 'C1',
      cefrLevelMax: 'C2',
      visibility: 'PUBLIC',
      sensitiveSpeechDetectionEnabled: false,
      postRoomKeywordsEnabled: false,
    });
    created = true;
    return route.fulfill({ json: { id: 'created-room' } });
  });
  await page.goto('/?screen=create');
  for (const name of ['A1～A2', 'B1～B2', 'C1～C2'])
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  for (const name of ['最低等级', '最高等级', '可发现性', '房间音频处理'])
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  const title = page.getByText('房间主题', { exact: true });
  await expect(title).toBeVisible();
  const titleBounds = await title.boundingBox();
  expect(titleBounds?.height).toBeGreaterThanOrEqual(24);
  await page.getByRole('textbox', { name: '房间主题' }).fill('周末旅行');
  await page.getByRole('button', { name: 'C1～C2', exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: 'docs/acceptance/simplify-room-and-mobile-experience/create-three-ranges-runtime.png',
  });
  await page.getByRole('button', { name: '创建并开放房间' }).click();
  await expect(page).toHaveURL(/\/rooms\/created-room\/session$/);
  expect(created).toBe(true);
  expect(errors).toEqual([]);
});

test('a device warning stays inside the actual room and retry removes it', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-28T09:00:00Z'));
  await page.route('**/v1/rooms/visual-room/messages*', (route) =>
    route.fulfill({ json: { items: [], nextCursor: 'cursor', hasMore: false } }),
  );
  await page.goto('/?device=blocked');
  await expect(
    page.getByText('麦克风权限已关闭，请在系统设置中开启；仍可听音和发文字。'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '打开系统设置' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: 'docs/acceptance/simplify-direct-room-entry/device-warning-runtime-fixture.png',
  });
  await page.getByRole('button', { name: '重新检查设备' }).click();
  await expect(
    page.getByText('麦克风权限已关闭，请在系统设置中开启；仍可听音和发文字。'),
  ).toHaveCount(0);
  await expect(page.getByText('聊聊旅行中的意外收获')).toBeVisible();
});
