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
  await expect(page).toHaveURL(new RegExp(`/rooms/${entryRoomId}/password$`));
  await expect(page.getByRole('button', { name: '进入语音房' })).toBeDisabled();
  await page.getByTestId('room-password').fill('1234');
  await page.getByRole('button', { name: '进入语音房' }).click();
  await expect(page).toHaveURL(new RegExp(`/rooms/${entryRoomId}/session$`));
  await expect.poll(() => joins.length).toBe(1);
  expect(joins[0]).toEqual({ rulesAccepted: true, password: '1234' });
});
