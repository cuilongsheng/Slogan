import { expect, test, type Page } from '@playwright/test';
const evidence = 'docs/acceptance/main-pages-live-updates/runtime';
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
    if (path === '/v1/me/live-updates') return route.continue();
    let body: unknown = {};
    if (path === '/v1/people/available')
      body = { items: options.empty ? [] : peers, nextCursor: null };
    else if (path === '/v1/me/conversations/unread') body = { unreadCount: 4 };
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
    else if (path.endsWith('/timeline'))
      body = {
        items: url.searchParams.has('after')
          ? []
          : [
              {
                kind: 'text',
                revision: 1,
                value: {
                  id: 'message-1',
                  senderUserId: 'peer-0',
                  text: 'What movie did you watch?',
                  sequence: 1,
                  createdAt: now.toISOString(),
                },
              },
              {
                kind: 'text',
                revision: 2,
                value: {
                  id: 'message-2',
                  senderUserId: 'visual-profile',
                  text: 'I watched The Secret Life of Walter Mitty.',
                  sequence: 2,
                  createdAt: now.toISOString(),
                },
              },
            ],
        visibleAfterSequence: 0,
        nextBeforeCursor: null,
        hasOlder: false,
        syncCursor: 'fixture-sync',
        nextAfterCursor: null,
        hasMoreChanges: false,
      };
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
  await expect(page.getByTestId('empty-list-refresh')).toBeVisible();
  await expect(page.getByText('No available partners right now.')).toHaveCount(0);
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
  await page.getByRole('button', { name: 'Chat actions', exact: true }).click();
  await page.getByText('Block', { exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await capture(page, 'block');
  await page.getByText('Cancel', { exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: 'Chat actions', exact: true }).click();
  await page.getByText('Report message', { exact: true }).click();
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
    await route.fulfill({
      status: 201,
      json: { id: 'report-fixture', caseId: 'case-fixture', submittedAt: now.toISOString() },
    });
  });
  await page.goto('/?screen=chat&language=en');
  await expect(page.getByText('What movie did you watch?')).toBeVisible();
  await page.getByRole('button', { name: 'Chat actions', exact: true }).click();
  await page.getByText('Report message', { exact: true }).click();
  await page.getByText('I watched The Secret Life of Walter Mitty.', { exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(reported).toHaveLength(0);
  await page
    .getByRole('button', { name: 'Report this message: What movie did you watch?' })
    .click();
  await page.getByRole('textbox').last().fill('Repeated harassment');
  await page.getByText('Confirm', { exact: true }).click();
  await expect(page.getByText('Report submitted', { exact: true })).toBeVisible();
  await expect(page.getByTestId('report-receipt')).toBeVisible();
  await expect(page.getByRole('button', { name: 'View my reports' })).toBeVisible();
  await page.screenshot({
    path: 'docs/acceptance/invitation-report-feedback/runtime/direct-receipt.png',
  });
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
  await expect(row.getByText('View', { exact: true })).toHaveCount(0);
  await expect(row.getByRole('img', { name: 'View', exact: true })).toBeVisible();
  await row.click({ delay: 600 });
  await expect(page.getByRole('dialog')).toBeVisible();
  await capture(page, 'delete');
  await page.getByText('Cancel', { exact: true }).click();
  await row.click();
  await expect(page).toHaveURL('/messages/conversation-luna');
});

test('compact bubbles and input preserve legible text while a call event cannot acknowledge unseen text', async ({
  page,
}) => {
  await fixtures(page);
  const reads: number[] = [];
  await page.route('**/v1/conversations/conversation-luna/read', (route) => {
    reads.push(route.request().postDataJSON().sequence);
    return route.fulfill({ json: conversation() });
  });
  await page.route('**/v1/conversations/conversation-luna/timeline*', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            kind: 'text',
            revision: 1,
            value: {
              id: 'message-1',
              senderUserId: 'peer-0',
              text: 'What movie did you watch?',
              sequence: 1,
              createdAt: now.toISOString(),
            },
          },
          {
            kind: 'call',
            revision: 900,
            value: { id: 'past-call', sequence: 900, status: 'ENDED' },
          },
        ],
        visibleAfterSequence: 0,
        nextBeforeCursor: null,
        hasOlder: false,
        syncCursor: 'fixture-sync',
        nextAfterCursor: null,
        hasMoreChanges: false,
      },
    }),
  );
  await page.goto('/?screen=chat&language=en');
  const input = page.getByTestId('direct-message-input');
  await expect(input).toHaveAttribute('placeholder', 'Say something…');
  await expect(page.getByText('What movie did you watch?', { exact: true })).toBeVisible();
  await expect.poll(() => reads.length).toBeGreaterThan(0);
  expect(reads.every((sequence) => sequence === 1)).toBe(true);
  const box = await input.boundingBox();
  expect(box!.height).toBe(46);
  await expect(
    page.getByText('Voice calls connect only after the other person accepts.'),
  ).toHaveCount(0);
});

test('main tab headings are centered and incoming messages show a navigation badge', async ({
  page,
}) => {
  await fixtures(page);
  await page.goto('/?screen=partners&language=en');
  await expect(page.getByText('Luna', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Partners', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Messages, 4 unread', exact: true })).toBeVisible();
  await page.goto('/?screen=me&language=en');
  await expect(page.getByRole('button', { name: 'Edit profile', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Me', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit profile', exact: true })).toBeVisible();
});

test('SSE outage retains partner rows and shows localized reconnection feedback', async ({
  page,
}) => {
  await fixtures(page);
  await page.goto('/?screen=partners&language=en&live=reconnecting');
  await expect(page.getByText('Luna', { exact: true })).toBeVisible();
  await expect(page.getByText('Ravi', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Reconnecting');
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.screenshot({
    path: 'docs/acceptance/main-page-sse/runtime/partners-reconnecting.png',
  });
});

test('a partner invalidation arriving during pagination is replayed after that page completes', async ({
  page,
}) => {
  await fixtures(page);
  let expanded = false,
    reads = 0,
    release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/v1/people/available*', async (route) => {
    const cursor = new URL(route.request().url()).searchParams.get('cursor');
    if (cursor) {
      if (++reads === 1) await held;
      return route.fulfill({ json: { items: [peers[2]], nextCursor: null } });
    }
    return route.fulfill({
      json: { items: expanded ? [peers[0], peers[1]] : [peers[0]], nextCursor: 'next' },
    });
  });
  await page.goto('/?screen=partners&language=en');
  await expect(page.getByText('Luna', { exact: true })).toBeVisible();
  // FlatList automatically requests its next page when this short list reaches the viewport end.
  await expect.poll(() => reads).toBe(1);
  expanded = true;
  await page.evaluate(() => window.dispatchEvent(new Event('fixture-live-partners')));
  release();
  await expect(page.getByText('Mika', { exact: true })).toBeVisible();
  await expect(page.getByText('Ravi', { exact: true })).toBeVisible();
  await expect(page.getByText('Luna', { exact: true })).toBeVisible();
  await page.screenshot({
    path: 'docs/acceptance/main-page-sse/runtime/partners-retained-pages.png',
  });
});

for (const [status, message] of [
  [403, 'Access to this list is restricted.'],
  [503, 'This list is temporarily unavailable.'],
] as const)
  test(`partner ${status} failure is distinct from a successful empty list`, async ({ page }) => {
    await fixtures(page);
    await page.route('**/v1/people/available*', (route) =>
      route.fulfill({
        status,
        json: { code: status === 403 ? 'SOCIAL_ACCESS_RESTRICTED' : 'SOCIAL_PRESENCE_UNAVAILABLE' },
      }),
    );
    await page.goto('/?screen=partners&language=en');
    await expect(page.getByRole('alert')).toContainText(message);
    await expect(page.getByTestId('empty-list-refresh')).toBeVisible();
    await page.screenshot({ path: `docs/acceptance/main-page-sse/runtime/partners-${status}.png` });
  });

test('long chat loads latest20, prepends20 with a stable anchor, and one shared SSE keeps idle requests quiet', async ({
  page,
}, info) => {
  await fixtures(page);
  const id = `915261f9-28de-4e64-bb21-${info.workerIndex.toString(16).padStart(12, '0')}`;
  let connections = 0;
  const isStream = (url: string) => new URL(url).pathname === '/v1/me/live-updates';
  page.on('request', (request) => {
    if (isStream(request.url())) connections++;
  });
  await page.route(`**/v1/conversations/${id}`, (route) =>
    route.fulfill({ json: { ...conversation(), id } }),
  );
  const requests: string[] = [];
  let newest = 65;
  await page.route(`**/v1/conversations/${id}/timeline*`, (route) => {
    const url = new URL(route.request().url());
    requests.push(url.search);
    expect(url.searchParams.get('limit')).toBe('20');
    const before = url.searchParams.get('before');
    const after = url.searchParams.get('after');
    const end = before ? Number(before) - 1 : newest;
    const start = after ? Number(after) + 1 : Math.max(1, end - 19);
    const values = Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);
    return route.fulfill({
      json: {
        items: values.map((n) => ({
          kind: 'text',
          revision: n,
          value: {
            id: `long-${n}`,
            senderUserId: 'peer-0',
            text: `History entry ${n} with enough text to wrap into two lines.`,
            sequence: n,
            createdAt: now.toISOString(),
          },
        })),
        visibleAfterSequence: 0,
        nextBeforeCursor: start > 1 ? String(start) : null,
        hasOlder: start > 1,
        syncCursor: String(newest),
        nextAfterCursor: null,
        hasMoreChanges: false,
      },
    });
  });
  await page.goto(`/?screen=chat&language=en&transport=real&conversationId=${id}`);
  await expect(page.getByText(/History entry 65 /)).toBeVisible();
  expect(requests).toEqual(['?limit=20']);
  expect(connections).toBe(1);
  await page.waitForTimeout(6500);
  expect(requests).toHaveLength(1);
  expect(connections).toBe(1);
  const earlier = page.getByRole('button', { name: 'Load earlier history' });
  await earlier.scrollIntoViewIfNeeded();
  const anchor = page.getByTestId('chat-entry-long-46');
  await expect(anchor).toBeVisible();
  const top = (await anchor.boundingBox())!.y;
  await earlier.click();
  await expect.poll(() => requests.length).toBe(2);
  await expect.poll(async () => (await anchor.boundingBox())!.y).toBeCloseTo(top, 0);
  newest = 66;
  await page.request.post(
    '/__fixture/live?scope=conversation-history&resourceId=11111111-1111-4111-8111-111111111111',
  );
  await page.waitForTimeout(100);
  expect(requests).toHaveLength(2);
  await page.request.post(`/__fixture/live?scope=conversation-history&resourceId=${id}`);
  await expect.poll(() => requests.length).toBe(3);
  expect(new URLSearchParams(requests[2]).get('after')).toBe('65');
  await expect.poll(async () => (await anchor.boundingBox())!.y).toBeCloseTo(top, 0);
  await page.screenshot({ path: 'docs/acceptance/unified-mobile-events/chat-older-runtime.png' });
  await page.goto('about:blank');
  await expect
    .poll(
      async () =>
        (
          await (
            await page.request.get(`http://localhost:8094/__fixture/live?conversationId=${id}`)
          ).json()
        ).active,
    )
    .toBe(0);
});
