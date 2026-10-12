import { expect, test } from '@playwright/test';
const evidence = 'docs/acceptance/room-reporting-and-discovery';
test('occupied avatars and the three-action menu report the exact target without leaving', async ({
  page,
}) => {
  await page.route('**/v1/rooms/visual-room/messages*', (route) =>
    route.fulfill({ json: { items: [], nextCursor: 'fixture', hasMore: false } }),
  );
  const reports: Record<string, unknown>[] = [];
  await page.route('**/v1/rooms/visual-room/reports', (route) => {
    reports.push(route.request().postDataJSON());
    return route.fulfill({
      status: 201,
      json: { id: 'report-fixture', caseId: 'case-fixture', submittedAt: new Date().toISOString() },
    });
  });
  await page.goto('/?count=4&capacity=6&role=host');
  await page.getByRole('button', { name: 'Mika', exact: true }).click();
  await expect(page.getByText('举报房间成员', { exact: true })).toBeVisible();
  await expect(page.getByText('Mika', { exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: '骚扰辱骂', exact: true }).click();
  await page.getByRole('textbox', { name: '详细说明' }).fill('Member report details');
  await page.getByRole('button', { name: '提交举报', exact: true }).click();
  expect(reports[0]?.targetUserId).toBe('user-1');
  await page.getByRole('button', { name: '关闭', exact: true }).last().click();
  await page.getByRole('button', { name: '房间操作', exact: true }).click();
  await expect(page.getByRole('button', { name: '举报房间', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '分享房间链接', exact: true })).toBeVisible();
  await page.screenshot({ path: `${evidence}/runtime-room-actions.png` });
  await page.getByRole('button', { name: '举报房间', exact: true }).click();
  const input = await page.getByRole('textbox', { name: '详细说明' }).boundingBox();
  expect(input).toMatchObject({ x: 24, y: 605, width: 342, height: 95 });
  await page.screenshot({ path: `${evidence}/runtime-room-report.png` });
  await page.getByRole('button', { name: '其他', exact: true }).click();
  await page.getByRole('textbox', { name: '详细说明' }).fill('Room report details');
  await page.getByRole('button', { name: '提交举报', exact: true }).click();
  expect(reports[1]).not.toHaveProperty('targetUserId');
  await page.getByRole('button', { name: '关闭', exact: true }).last().click();
  await expect(page.getByTestId('room-seat-row-0')).toBeVisible();
});
test('creation stays compact on tall web previews and remains usable at a reduced viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 1258 });
  await page.goto('/?screen=create&language=en');
  const action = page.getByRole('button', { name: 'Create and open room', exact: true });
  expect((await action.boundingBox())?.height).toBe(56);
  expect((await action.boundingBox())?.y).toBe(971);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${evidence}/runtime-create-en.png` });
  await page.setViewportSize({ width: 360, height: 540 });
  await page.getByRole('textbox', { name: 'Room topic', exact: true }).fill('Travel practice');
  await expect(action).toBeVisible();
  await page.screenshot({ path: `${evidence}/runtime-create-small-focused.png` });
});
test('only the current tab is accented, with no selection circle', async ({ page }) => {
  await page.goto('/?screen=me&language=en');
  const tints = await page.locator('[role="button"]').evaluateAll((nodes) =>
    nodes
      .filter((node) => ['Me', 'Discover'].includes(node.getAttribute('aria-label') ?? ''))
      .map((node) => ({
        label: node.getAttribute('aria-label'),
        tint: node.querySelector('feFlood')?.getAttribute('flood-color'),
        background: getComputedStyle(node).backgroundColor,
      })),
  );
  expect(tints.find((item) => item.label === 'Me')?.tint).not.toEqual(
    tints.find((item) => item.label === 'Discover')?.tint,
  );
  expect(tints.every((item) => item.background === 'rgba(0, 0, 0, 0)')).toBe(true);
  await page.screenshot({ path: `${evidence}/runtime-nav-me.png` });
});
