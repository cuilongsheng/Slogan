import { expect, test } from '@playwright/test';

const evidence = 'docs/acceptance/room-usability';

test.beforeEach(async ({ page }) => {
  await page.route('**/v1/rooms/visual-room/messages*', (route) =>
    route.fulfill({ json: { items: [], nextCursor: 'fixture', hasMore: false } }),
  );
});

test('voice and discovery share iPhone 17 bounds on a tall desktop and fit smaller viewports', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto('/?role=host&count=4&capacity=4');
  const frame = page.getByTestId('voice-room-direct-entry-v2');
  expect(await frame.boundingBox()).toMatchObject({ x: 519, y: 163, width: 402, height: 874 });
  const seats = page.getByTestId('room-seat-row-0');
  expect(await seats.locator('[data-testid^="room-seat-member-"]').count()).toBe(4);
  await page.screenshot({ path: `${evidence}/runtime-desktop-bounded.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${evidence}/runtime-original-390.png` });
  await page.setViewportSize({ width: 320, height: 540 });
  expect(await frame.boundingBox()).toMatchObject({ width: 320, height: 540 });
  await expect(page.getByRole('button', { name: '打开麦克风', exact: true })).toBeVisible();
});

test('mouse invitation opens immediately, loads available partners, and sends the exact target', async ({
  page,
}) => {
  let sent: unknown;
  await page.route('**/v1/people/available*', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            userId: 'idle-partner',
            displayName: 'Available partner',
            cefrLevel: 'B1',
            isAvailable: true,
          },
        ],
        nextCursor: null,
      },
    }),
  );
  await page.route('**/v1/rooms/visual-room/invitations', (route) => {
    sent = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { id: 'invitation', status: 'PENDING' } });
  });
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto('/?role=host&language=en');
  await page.getByTestId('room-empty-seat-4').click();
  await expect(page.getByText('Available partner', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Invite Available partner', exact: true }).click();
  expect(sent).toMatchObject({ targetUserId: 'idle-partner' });
  await page.screenshot({ path: `${evidence}/runtime-invite-desktop.png` });
});

test('share copies without another dialog and assistance is dark and disabled', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/?role=host&language=en');
  await page.getByRole('button', { name: 'Room actions', exact: true }).click();
  await page.getByRole('button', { name: 'Share room link', exact: true }).click();
  await expect(page.getByText('Link copied', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'https://example.test/share/fixture',
  );
  await expect(page.getByText('https://example.test/share/fixture', { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByRole('button', {
      name: 'Find English in your language · Only visible to you',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('button', { name: 'Accept and continue', exact: true }),
  ).toBeDisabled();
  expect(
    await page
      .getByTestId('expression-assistance-sheet')
      .evaluate((node) => getComputedStyle(node).backgroundColor),
  ).toBe('rgb(52, 39, 79)');
  await page.screenshot({ path: `${evidence}/runtime-dark-assistance.png` });
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page).toHaveURL('/?role=host&language=en');
});

test('missing and failed avatar URLs use visible bundled cartoons', async ({ page }) => {
  await page.goto('/?missingAvatars&count=2&capacity=4&role=host');
  const avatars = page.getByTestId('room-member-avatar').locator('img');
  await expect(avatars).toHaveCount(2);
  await expect
    .poll(() =>
      avatars.evaluateAll((images) =>
        images.every((image) => (image as HTMLImageElement).naturalWidth === 256),
      ),
    )
    .toBe(true);
  await page.screenshot({ path: `${evidence}/runtime-cartoon-fallbacks.png` });
});

test('an already open invitation picker discovers a newly idle peer without closing', async ({
  page,
}) => {
  await page.clock.install();
  let items: Record<string, unknown>[] = [];
  await page.route('**/v1/people/available*', (route) =>
    route.fulfill({ json: { items, nextCursor: null } }),
  );
  await page.goto('/?role=host&count=2&capacity=4&language=en');
  await page.getByRole('button', { name: 'Invite', exact: true }).first().click();
  await expect(page.getByText('No available people to invite')).toBeVisible();
  items = [
    { userId: 'new-idle', displayName: 'New idle peer', cefrLevel: 'B1', isAvailable: true },
  ];
  await page.clock.fastForward(5000);
  await expect(page.getByText('New idle peer')).toBeVisible();
});
