import { expect, test } from '@playwright/test';
import { entryRoomId, mobileOrigin, mockRoomEntry } from '../fixtures/mobile-room-entry';

test.use({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });

test('a room card directly invokes admission without rules or device pages', async ({ page }) => {
  const { joins, consentCommands } = await mockRoomEntry(page);
  await page.goto(`${mobileOrigin}/rooms`);
  await expect(page.getByText('旅行英语练习')).toBeVisible();
  await page.screenshot({
    path: 'docs/acceptance/simplify-direct-room-entry/list-runtime-web-fixture.png',
  });
  await page.getByText('旅行英语练习').click();
  await expect(page).toHaveURL(new RegExp(`/rooms/${entryRoomId}/session$`));
  await expect.poll(() => joins.length).toBe(1);
  expect(joins[0]).toEqual({ rulesAccepted: true });
  expect(consentCommands).toEqual([]);
  await expect(page.getByRole('button', { name: '重试', exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await page.screenshot({
    path: 'docs/acceptance/simplify-direct-room-entry/join-error-runtime-web-fixture.png',
  });
});

test('password entry proceeds straight to admission', async ({ page }) => {
  const { joins } = await mockRoomEntry(page, { password: true });
  await page.goto(`${mobileOrigin}/rooms`);
  await page.getByText('旅行英语练习').click();
  await expect(page).toHaveURL(new RegExp(`/rooms/${entryRoomId}/session$`));
  await expect(page.getByRole('button', { name: '进入语音房' })).toBeDisabled();
  await page.getByTestId('room-password').fill('1234');
  await page.getByRole('button', { name: '进入语音房' }).click();
  await expect(page).toHaveURL(new RegExp(`/rooms/${entryRoomId}/session$`));
  await expect.poll(() => joins.length).toBe(1);
  expect(joins[0]).toEqual({ rulesAccepted: true, password: '1234' });
});

for (const legacy of ['', '/rules', '/device', '/password']) {
  test(`legacy ${legacy || 'detail'} URL enters directly and keeps invitation`, async ({
    page,
  }) => {
    const { joins } = await mockRoomEntry(page);
    await page.goto(`${mobileOrigin}/rooms/${entryRoomId}${legacy}?invitationId=invite-a`);
    await expect(page).toHaveURL(
      new RegExp(`/rooms/${entryRoomId}/session\\?invitationId=invite-a$`),
    );
    await expect.poll(() => joins.length).toBe(1);
    expect(joins[0]).toEqual({ rulesAccepted: true, invitationId: 'invite-a' });
    await expect(page.getByText('设备检查', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('checkbox')).toHaveCount(0);
  });
}

test('wrong password is corrected in the same dialog, without a preparation page', async ({
  page,
}) => {
  const { joins } = await mockRoomEntry(page, { password: true });
  await page.goto(`${mobileOrigin}/rooms`);
  await page.getByText('旅行英语练习').click();
  expect(joins).toEqual([]);
  await page.getByTestId('room-password').fill('1111');
  await page.getByRole('button', { name: '进入语音房' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByTestId('room-password').fill('1234');
  await page.getByRole('button', { name: '进入语音房' }).click();
  await expect.poll(() => joins.length).toBe(2);
  expect(joins[1]).toEqual({ rulesAccepted: true, password: '1234' });
  await expect(page).toHaveURL(new RegExp(`/rooms/${entryRoomId}/session$`));
});

test('a shared instant room opens the same direct session', async ({ page }) => {
  const { joins } = await mockRoomEntry(page);
  await page.route('**/v1/room-links/share-a', (route) =>
    route.fulfill({ json: { id: entryRoomId, kind: 'INSTANT' } }),
  );
  await page.goto(`${mobileOrigin}/r/share-a`);
  await expect(page).toHaveURL(new RegExp(`/rooms/${entryRoomId}/session$`));
  await expect.poll(() => joins.length).toBe(1);
});
