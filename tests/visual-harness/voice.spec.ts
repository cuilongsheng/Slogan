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
      senderDisplayName: 'Luna',
      text: '上次旅行我坐错了车…',
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
  await page.goto('/');
  await expect(page.getByText('聊聊旅行中的意外收获')).toBeVisible();
  await expect(page.getByText('上次旅行我坐错了车…')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: 'docs/acceptance/simplify-room-and-mobile-experience/voice-runtime-component-fixture.png',
  });
  await page.getByRole('textbox').fill('Hello room');
  await page.getByRole('button', { name: '发送消息' }).click();
  await expect(page.getByText('Hello room', { exact: true })).toBeVisible();
  await page.getByText('用母语找英文表达 · 仅自己可见').click();
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
  await page.getByText('用母语找英文表达 · 仅自己可见').click();
  await expect(page.getByRole('button', { name: '同意并继续' })).toBeVisible();
  await page.screenshot({
    path: 'docs/acceptance/simplify-room-and-mobile-experience/translation-consent-runtime-component-fixture.png',
  });
  await page.getByRole('button', { name: '同意并继续' }).click();
  await expect(page.getByRole('button', { name: '按着开始说' })).toBeVisible();
  expect(errors).toEqual([]);
});
