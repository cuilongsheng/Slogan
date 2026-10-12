import { expect, test, type Page } from '@playwright/test';
const evidence = 'docs/acceptance/simplified-direct-pages/runtime';
const now = new Date('2026-10-11T02:42:00Z');
const peers = ['Luna', 'Mika', 'Ravi'].map((displayName, index) => ({
  userId: `peer-${index}`,
  displayName,
  avatarUrl: `http://localhost:8094/fixtures/${displayName}.png`,
  cefrLevel: index === 2 ? 'C1_C2' : 'B1_B2',
  availability: 'AVAILABLE',
}));
const conversation = (index = 0) => ({
  id: index === 0 ? 'conversation-luna' : 'conversation-ravi',
  peer: peers[index],
  canInteract: true,
  visibleAfterSequence: 0,
  unreadCount: 2,
  lastActivityAt: now.toISOString(),
  lastMessage: {
    text: index === 0 ? 'You: Talk about movies again?' : 'Thanks for your advice!',
    sequence: 2,
  },
  lastCall: null,
});
async function fixtures(
  page: Page,
  options: { empty?: boolean; error?: boolean; status?: string; incoming?: boolean } = {},
) {
  await page.clock.setFixedTime(now);
  await page.route('**/fixtures/*.png', (route) =>
    route.fulfill({
      path: `tests/fixtures/direct-avatars/${route.request().url().split('/').pop()}`,
    }),
  );
  await page.route('**/v1/**', async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    let body: unknown = {};
    if (path === '/v1/people/available')
      body = { items: options.empty ? [] : peers, nextCursor: null };
    else if (path === '/v1/me/friends')
      body = {
        items: [peers[0], peers[2]].map((friend, index) => ({ id: `friend-${index}`, friend })),
        nextCursor: null,
      };
    else if (path === '/v1/me/conversations') {
      if (options.error) return route.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } });
      body = { items: [conversation(), conversation(2)], nextCursor: null };
    } else if (path === '/v1/conversations' || path === '/v1/conversations/conversation-luna')
      body = conversation();
    else if (path.endsWith('/messages'))
      body = {
        items: [
          {
            id: 'message-1',
            senderUserId: 'peer-0',
            text: 'What movie did you watch?',
            sequence: 1,
            createdAt: now.toISOString(),
          },
          {
            id: 'message-2',
            senderUserId: 'visual-profile',
            text: 'I watched The Secret Life of Walter Mitty.',
            sequence: 2,
            createdAt: now.toISOString(),
          },
        ],
        nextCursor: null,
        visibleAfterSequence: 0,
      };
    else if (path.endsWith('/calls'))
      body = { items: [], nextCursor: null, visibleAfterSequence: 0 };
    else if (path.endsWith('/credentials'))
      body = {
        url: 'wss://fixture.invalid',
        token: 'explicit-fixture',
        expiresAt: now.toISOString(),
      };
    else if (path.startsWith('/v1/direct-calls/'))
      body = {
        id: 'call-luna',
        conversationId: 'conversation-luna',
        callerUserId: options.incoming ? 'peer-0' : 'visual-profile',
        calleeUserId: options.incoming ? 'visual-profile' : 'peer-0',
        peer: peers[0],
        status: options.status ?? 'RINGING',
        acceptedAt: new Date(+now - 42000).toISOString(),
      };
    await route.fulfill({ json: body });
  });
}
async function capture(page: Page, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, (img) => img.decode().catch(() => undefined)));
  });
  await page.screenshot({ path: `${evidence}/${name}.png` });
}
for (const [name, screen] of [
  ['partners', 'partners'],
  ['recent', 'messages'],
  ['chat', 'chat'],
  ['me', 'me'],
] as const)
  test(`capture ${name} actual component`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await fixtures(page);
    await page.goto(`/?screen=${screen}&language=en`);
    await expect(
      page.getByText(name === 'partners' ? 'Ravi' : 'Luna', { exact: true }).first(),
    ).toBeVisible();
    await capture(page, name);
    expect(errors).toEqual([]);
  });
for (const [name, status, incoming, extra] of [
  ['incoming', 'RINGING', true, ''],
  ['outgoing', 'RINGING', false, ''],
  ['active', 'ACTIVE', false, ''],
  ['reconnecting', 'ACTIVE', false, '&connection=reconnecting'],
  ['ended', 'ENDED', false, ''],
  ['expired', 'EXPIRED', false, ''],
  ['device', 'ACTIVE', false, '&device=blocked'],
] as const)
  test(`capture ${name} call state`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await fixtures(page, { status, incoming });
    await page.goto(`/?screen=call&language=en${extra}`);
    if (!['ended', 'expired'].includes(name))
      await expect(page.getByText(/Luna/).first()).toBeVisible();
    if (name === 'device') await expect(page.getByRole('alert')).toBeVisible();
    await capture(page, name);
    expect(errors).toEqual([]);
    if (name === 'active') {
      await page.getByRole('button', { name: 'End call', exact: true }).click();
      await expect(page).toHaveURL('/messages/conversation-luna');
      expect(await page.evaluate(() => Reflect.get(globalThis, '__mediaStopped'))).toBe(true);
    }
  });
test('empty/error recovery preserves recent conversations without a Friends tab', async ({
  page,
}) => {
  await fixtures(page, { empty: true, error: true });
  await page.goto('/?screen=partners&language=en');
  await expect(page.getByText('No available partners right now.')).toBeVisible();
  await capture(page, 'partners-empty');
  await page.goto('/?screen=messages&language=en');
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  await capture(page, 'messages-error');
  await page.route('**/v1/me/conversations*', (route) =>
    route.fulfill({ json: { items: [conversation()], nextCursor: null } }),
  );
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByText('Luna', { exact: true })).toBeVisible();
  await expect(page.getByText('Friends', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Recent conversations and friends')).toHaveCount(0);
});
test('chat action dialogs match design and cancel locally', async ({ page }) => {
  await fixtures(page);
  await page.goto('/?screen=chat&language=en');
  await expect(page.getByText('What movie did you watch?')).toBeVisible();
  await page.getByText('Block', { exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await capture(page, 'block');
  await page.getByText('Cancel', { exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: '⋯ Report message' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('alert')).toHaveText('Select a received message to report.');
  await page
    .getByRole('button', { name: 'Report this message: What movie did you watch?' })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('textbox').last().fill('Repeated unwanted messages.');
  await page.getByText('Report message', { exact: true }).click();
  await capture(page, 'report');
});

test('failed send retries the same id and preserves a single delivered message', async ({
  page,
}) => {
  await fixtures(page);
  const requests: Array<{ clientRequestId: string; text: string }> = [];
  await page.route('**/v1/conversations/conversation-luna/messages', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const input = route.request().postDataJSON();
    requests.push(input);
    return requests.length === 1
      ? route.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } })
      : route.fulfill({
          status: 201,
          json: {
            id: 'sent-retry',
            senderUserId: 'visual-profile',
            sequence: 3,
            text: input.text,
            clientRequestId: input.clientRequestId,
            createdAt: now.toISOString(),
          },
        });
  });
  await page.goto('/?screen=chat&language=en');
  await expect(page.getByText('What movie did you watch?')).toBeVisible();
  await page.getByTestId('direct-message-input').fill('Retry once');
  await page.getByTestId('direct-message-send').click();
  await page.getByText('Send unconfirmed. Tap to retry', { exact: true }).click();
  await expect(page.getByText('Retry once', { exact: true })).toHaveCount(1);
  await expect(page.getByTestId('direct-message-input')).toHaveValue('');
  expect(requests).toHaveLength(2);
  expect(requests[0]).toEqual(requests[1]);
});

test('report toolbar submits only the explicitly selected received message', async ({ page }) => {
  await fixtures(page);
  const reported: unknown[] = [];
  await page.route('**/v1/conversations/conversation-luna/messages/*/report', async (route) => {
    reported.push({ url: route.request().url(), body: route.request().postDataJSON() });
    await route.fulfill({ status: 201, json: {} });
  });
  await page.goto('/?screen=chat&language=en');
  await expect(page.getByText('What movie did you watch?')).toBeVisible();
  await page.getByRole('button', { name: '⋯ Report message' }).click();
  await page.getByText('I watched The Secret Life of Walter Mitty.', { exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(reported).toHaveLength(0);
  await page
    .getByRole('button', { name: 'Report this message: What movie did you watch?' })
    .click();
  await page.getByRole('textbox').last().fill('Repeated harassment');
  await page.getByText('Confirm', { exact: true }).click();
  await expect(page.getByText('Report submitted', { exact: true })).toBeVisible();
  expect(reported).toHaveLength(1);
  expect(reported[0]).toEqual(
    expect.objectContaining({
      url: expect.stringContaining('/messages/message-1/report'),
      body: expect.objectContaining({ description: 'Repeated harassment' }),
    }),
  );
});

test('recent View action preserves unread semantics and personal history deletion', async ({
  page,
}) => {
  await fixtures(page);
  await page.goto('/?screen=messages&language=en');
  const row = page.getByRole('button', { name: 'Luna, 2 unread messages', exact: true });
  await expect(row.getByText('View', { exact: true })).toBeVisible();
  await row.click({ delay: 600 });
  await expect(page.getByRole('dialog')).toBeVisible();
  await capture(page, 'delete');
  await page.getByText('Cancel', { exact: true }).click();
  await row.click();
  await expect(page).toHaveURL('/messages/conversation-luna');
});
