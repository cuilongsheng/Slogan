import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Shanghai' });

test('approved room layout at desktop viewport with deterministic visual data', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-09-28T08:04:00Z'));
  const roomQueries: string[] = [];
  let firstRoomEnded = false;
  await page.route('**/v1/auth/web/refresh', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accessToken: 'visual-test', accessTokenExpiresInSeconds: 900 }),
    }),
  );
  await page.route('**/v1/backoffice/me', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        userId: '00000000-0000-4000-8000-000000000001',
        roles: ['PLATFORM_ADMIN'],
      }),
    }),
  );
  await page.route('**/v1/backoffice/operations/rooms*', async (route) => {
    roomQueries.push(new URL(route.request().url()).search);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          ...(!firstRoomEnded
            ? [
                {
                  id: '00000000-0000-4000-8000-000000000011',
                  topic: '周末轻松聊：最近看过的电影',
                  kind: 'INSTANT',
                  visibility: 'PUBLIC',
                  status: 'OPEN',
                  cefrLevel: 'B1',
                  cefrLevelMin: 'B1',
                  cefrLevelMax: 'B2',
                  capacity: 4,
                  startedAt: '2026-09-28T08:00:00Z',
                  endsAt: '2026-09-28T09:00:00Z',
                  endedAt: null,
                  createdAt: '2026-09-28T08:00:00Z',
                  _count: { memberships: 3, reservations: 0, reports: 0 },
                },
              ]
            : []),
          {
            id: '00000000-0000-4000-8000-000000000012',
            topic: '工作中的英语表达',
            kind: 'INSTANT',
            visibility: 'LINK_ONLY',
            status: 'OPEN',
            cefrLevel: 'B2',
            capacity: 6,
            startedAt: '2026-09-28T08:00:00Z',
            endsAt: '2026-09-28T09:28:00Z',
            endedAt: null,
            createdAt: '2026-09-28T08:00:00Z',
            _count: { memberships: 6, reservations: 0, reports: 0 },
          },
          {
            id: '00000000-0000-4000-8000-000000000013',
            topic: '聊聊旅行中最难忘的事',
            kind: 'APPOINTMENT',
            visibility: 'PUBLIC',
            status: 'SCHEDULED',
            cefrLevel: 'A2',
            capacity: 6,
            startedAt: '2026-09-29T11:30:00Z',
            endsAt: '2026-09-29T12:30:00Z',
            endedAt: null,
            createdAt: '2026-09-28T08:00:00Z',
            _count: { memberships: 2, reservations: 2, reports: 0 },
          },
        ],
        nextCursor: null,
      }),
    });
  });
  await page.goto('/rooms');
  await expect(page.getByRole('heading', { name: '房间管理' })).toBeVisible();
  await expect(page.locator('.room-card')).toHaveCount(3);
  expect(
    await page
      .locator('.nav-icon')
      .first()
      .evaluate((icon) => getComputedStyle(icon).maskImage),
  ).not.toBe('none');
  await expect(page.locator('details')).toHaveCount(0);
  await expect(page.locator('.room-details').first()).toBeVisible();
  await expect(page.locator('.room-meta').first()).toContainText('B1–B2');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.room-grid')).not.toContainText('00000000-');
  expect(new URLSearchParams(roomQueries[0]).get('scope')).toBe('CURRENT');
  await page.screenshot({
    path: 'docs/acceptance/simplify-room-and-mobile-experience/admin-runtime-fixture.png',
    fullPage: false,
  });
  firstRoomEnded = true;
  // Keep the tab open: a server-side end must disappear on the next current-room refresh.
  await expect(page.locator('.room-card')).toHaveCount(2, { timeout: 20_000 });
  await expect(page.getByText('本页 2 个房间')).toBeVisible();
  await page.getByRole('combobox', { name: '房间状态' }).selectOption('OPEN');
  await page.getByRole('combobox', { name: '房间可见性' }).selectOption('PUBLIC');
  await page.getByRole('combobox', { name: '创建时间范围' }).selectOption('7d');
  await page.getByRole('textbox', { name: '搜索房间 ID 或主题' }).fill('电影');
  await page.getByRole('textbox', { name: '搜索房间 ID 或主题' }).press('Enter');
  await expect
    .poll(() =>
      roomQueries.some((query) => {
        const params = new URLSearchParams(query);
        return (
          params.get('q') === '电影' &&
          params.get('status') === 'OPEN' &&
          params.get('visibility') === 'PUBLIC' &&
          params.has('from')
        );
      }),
    )
    .toBe(true);
});

test('case and appeal statistics use server totals beside real list rows', async ({ page }) => {
  await page.route('**/v1/auth/web/refresh', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accessToken: 'visual-test' }),
    }),
  );
  await page.route('**/v1/backoffice/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        userId: '00000000-0000-4000-8000-000000000001',
        roles: ['PLATFORM_ADMIN', 'SAFETY_OFFICER'],
      }),
    }),
  );
  await page.route('**/v1/backoffice/safety/cases/summary', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ open: 12, highRisk: 2, closed: 35 }),
    }),
  );
  await page.route('**/v1/backoffice/safety/cases?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: '00000000-0000-4000-8000-000000000021',
            category: 'HARASSMENT_ABUSE',
            roomId: '00000000-0000-4000-8000-000000000031',
            targetUserId: '00000000-0000-4000-8000-000000000041',
            status: 'OPEN',
            assessedSeverity: 'HIGH_RISK',
            createdAt: '2026-09-28T08:00:00Z',
          },
        ],
        nextCursor: null,
      }),
    }),
  );
  await page.goto('/safety/cases');
  await expect(page.getByRole('heading', { name: '安全案件' })).toBeVisible();
  await expect(page.getByLabel('案件统计')).toContainText('12');
  await page.screenshot({
    path: 'test-results/admin-cases-1440-visual-fixture.png',
    fullPage: true,
  });
  await page.route(
    '**/v1/backoffice/safety/cases/00000000-0000-4000-8000-000000000021/evidence',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          report: { description: '用户反映在房间内遭到言语骚扰。' },
          activities: [],
        }),
      }),
  );
  await page.route('**/v1/backoffice/safety/cases/00000000-0000-4000-8000-000000000021', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '00000000-0000-4000-8000-000000000021',
        roomId: '00000000-0000-4000-8000-000000000031',
        targetUserId: '00000000-0000-4000-8000-000000000041',
        status: 'OPEN',
        category: 'HARASSMENT_ABUSE',
        assigneeUserId: null,
        decisionType: null,
        decisionReason: null,
      }),
    }),
  );
  await page.getByRole('button', { name: '查看 ›' }).click();
  await expect(page.getByRole('dialog', { name: /案件详情/ })).toContainText(
    '用户反映在房间内遭到言语骚扰',
  );
  await page.screenshot({
    path: 'test-results/admin-case-detail-1440-visual-fixture.png',
    fullPage: true,
  });

  await page.route('**/v1/backoffice/safety/appeals/summary', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pending: 8, upheld: 4, lifted: 6 }),
    }),
  );
  await page.route('**/v1/backoffice/safety/appeals?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: '00000000-0000-4000-8000-000000000051',
            restrictionId: '00000000-0000-4000-8000-000000000061',
            userId: '00000000-0000-4000-8000-000000000071',
            status: 'PENDING',
            reason: '请复核限制',
            submittedAt: '2026-09-28T08:00:00Z',
            decidedAt: null,
            decidedByUserId: null,
            decisionReason: null,
          },
        ],
        nextCursor: null,
      }),
    }),
  );
  await page.goto('/safety/appeals');
  await expect(page.getByRole('heading', { name: '限制申诉' })).toBeVisible();
  await expect(page.getByLabel('申诉统计')).toContainText('8');
  await page.screenshot({
    path: 'test-results/admin-appeals-1440-visual-fixture.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: '查看 ›' }).click();
  await expect(page.getByRole('dialog', { name: /申诉详情/ })).toContainText('人工复核决定');
  await page.screenshot({
    path: 'test-results/admin-appeal-detail-1440-visual-fixture.png',
    fullPage: true,
  });
  await page.getByRole('radio', { name: '维持限制' }).check();
  await page.getByPlaceholder('填写复核理由').fill('复核证据支持原限制');
  await page.getByRole('button', { name: '提交复核决定' }).click();
  await expect(page.getByRole('dialog', { name: '确认敏感操作' })).toBeVisible();
  await page.screenshot({
    path: 'test-results/admin-sensitive-confirm-1440-visual-fixture.png',
    fullPage: true,
  });
});

test('incident, role and audit desktop layouts render contract records', async ({ page }) => {
  await page.route('**/v1/auth/web/refresh', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accessToken: 'visual-test' }),
    }),
  );
  await page.route('**/v1/backoffice/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        userId: '00000000-0000-4000-8000-000000000001',
        roles: ['PLATFORM_ADMIN', 'SAFETY_OFFICER', 'AUDITOR'],
      }),
    }),
  );
  await page.route('**/v1/backoffice/safety-capability-incidents?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: '00000000-0000-4000-8000-000000000081',
            roomId: '00000000-0000-4000-8000-000000000011',
            component: 'SPEECH_TRANSCRIPTION',
            status: 'OPEN',
            startedAt: '2026-09-28T08:00:00Z',
            recoveredAt: null,
          },
        ],
        nextCursor: null,
      }),
    }),
  );
  await page.route('**/v1/backoffice/role-assignments?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: '00000000-0000-4000-8000-000000000091',
            userId: '00000000-0000-4000-8000-000000000001',
            role: 'PLATFORM_ADMIN',
            active: true,
            grantedAt: '2026-09-28T08:00:00Z',
            revokedAt: null,
          },
        ],
        nextCursor: null,
      }),
    }),
  );
  await page.route('**/v1/backoffice/audit-events?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: '00000000-0000-4000-8000-0000000000a1',
            occurredAt: '2026-09-28T08:00:00Z',
            action: 'ROLE_GRANTED',
            actorType: 'USER',
            actorUserId: '00000000-0000-4000-8000-000000000001',
            actorRoles: ['PLATFORM_ADMIN'],
            targetType: 'BACKOFFICE_ROLE_ASSIGNMENT',
            targetId: '00000000-0000-4000-8000-000000000091',
            result: 'SUCCEEDED',
            reason: 'fixture',
            requestId: null,
          },
        ],
        nextCursor: null,
      }),
    }),
  );
  for (const [path, heading, screenshot] of [
    ['/safety/incidents', '安全降级事件', 'admin-incidents-1440-visual-fixture.png'],
    ['/roles', '后台角色', 'admin-roles-1440-visual-fixture.png'],
    ['/audit', '操作审计', 'admin-audit-1440-visual-fixture.png'],
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await page.screenshot({ path: `test-results/${screenshot}`, fullPage: true });
    if (path === '/roles') {
      await page.getByRole('button', { name: '＋ 授予角色' }).click();
      await expect(page.getByRole('dialog', { name: '授予后台角色' })).toBeVisible();
      await page.screenshot({
        path: 'test-results/admin-role-grant-1440-visual-fixture.png',
        fullPage: true,
      });
      await page
        .getByPlaceholder('输入已存在的用户标识')
        .fill('00000000-0000-4000-8000-000000000002');
      await page.getByPlaceholder('说明授予原因').fill('授权安全员处理案件');
      await page.getByRole('button', { name: '下一步：确认' }).click();
      await expect(page.getByRole('dialog', { name: '确认敏感操作' })).toBeVisible();
      await page.getByRole('button', { name: '取消' }).click();
      await expect(page.getByRole('dialog', { name: '授予后台角色' })).toBeVisible();
      await expect(page.getByPlaceholder('说明授予原因')).toHaveValue('授权安全员处理案件');
    }
  }
});
