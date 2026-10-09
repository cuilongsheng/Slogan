import { expect, type Page } from '@playwright/test';

export const mobileOrigin = process.env.SLOGAN_MOBILE_E2E_ORIGIN ?? 'http://localhost:8082';
export const entryRoomId = '00000000-0000-4000-8000-000000000011';

// Explicit HTTP fixtures exercise the production routes/client. They do not prove LiveKit or cloud integration.
export async function mockRoomEntry(
  page: Page,
  options: { password?: boolean; processing?: boolean } = {},
) {
  const joins: Record<string, unknown>[] = [];
  const accepted = new Set<string>();
  const consentCommands: string[] = [];
  const room = {
    id: entryRoomId,
    kind: 'INSTANT',
    topic: '旅行英语练习',
    cefrLevel: 'B1',
    cefrLevelMin: 'B1',
    cefrLevelMax: 'B2',
    hostDisplayName: '小林',
    memberCount: 2,
    capacity: 6,
    endsAt: '2099-01-01T00:00:00Z',
    passwordProtected: Boolean(options.password),
    hostReconnectDeadline: null,
    sensitiveSpeechDetectionEnabled: Boolean(options.processing),
    postRoomKeywordsEnabled: Boolean(options.processing),
    visibility: 'PUBLIC',
    currentMembership: null,
    shareUrl: null,
  };
  await page.route('**/v1/auth/web/refresh', (route) =>
    route.fulfill({ json: { accessToken: 'fixture-only', accessTokenExpiresInSeconds: 900 } }),
  );
  await page.route('**/v1/me', (route) =>
    route.fulfill({
      json: {
        userId: '00000000-0000-4000-8000-000000000001',
        onboardingState: 'ELIGIBLE',
        profile: null,
      },
    }),
  );
  await page.route(/\/v1\/rooms(?:\?.*)?$/, (route) =>
    route.fulfill({ json: { items: [room], nextCursor: null } }),
  );
  await page.route(`**/v1/rooms/${entryRoomId}`, (route) => route.fulfill({ json: room }));
  await page.route(`**/v1/rooms/${entryRoomId}/memberships`, async (route) => {
    const body = route.request().postDataJSON();
    joins.push(body);
    expect(body.rulesAccepted).toBe(true);
    if (options.password) expect(body.password).toBe('1234');
    if (options.processing && accepted.size < 2)
      return route.fulfill({ status: 403, json: { code: 'ROOM_SPEECH_CONSENT_REQUIRED' } });
    return route.fulfill({
      status: 201,
      json: {
        ...room,
        currentMembership: {
          membershipId: 'fixture-member',
          lifecycle: 'ACTIVE',
          role: 'MEMBER',
          credentialVersion: 1,
        },
      },
    });
  });
  // Stop before real media: this deliberate provider failure verifies error recovery after admission.
  await page.route(`**/v1/rooms/${entryRoomId}/realtime-credentials`, (route) =>
    route.fulfill({ status: 503, json: { code: 'REALTIME_PROVIDER_UNAVAILABLE' } }),
  );
  await page.route('**/v1/me/speech-processing-consents', (route) =>
    route.fulfill({
      json: {
        items: ['ROOM_SAFETY_DETECTION', 'POST_ROOM_KEYWORDS'].map((purpose) => ({
          purpose,
          status: accepted.has(purpose) ? 'ACCEPTED' : 'REQUIRED',
          currentNoticeVersion: '2026-09-v1',
          noticeVersion: accepted.has(purpose) ? '2026-09-v1' : null,
          changedAt: null,
          providerCategory: null,
        })),
      },
    }),
  );
  await page.route('**/v1/me/speech-processing-consents/*', async (route) => {
    const purpose = route.request().url().endsWith('/room-safety')
      ? 'ROOM_SAFETY_DETECTION'
      : 'POST_ROOM_KEYWORDS';
    expect(route.request().postDataJSON()).toMatchObject({
      action: 'ACCEPT',
      noticeVersion: '2026-09-v1',
      clientRequestId: expect.any(String),
    });
    consentCommands.push(purpose);
    accepted.add(purpose);
    return route.fulfill({
      json: {
        purpose,
        status: 'ACCEPTED',
        currentNoticeVersion: '2026-09-v1',
        noticeVersion: '2026-09-v1',
        changedAt: new Date().toISOString(),
        providerCategory: null,
      },
    });
  });
  return { joins, accepted, consentCommands };
}
