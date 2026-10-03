import { RoomProcessingConsentApi, currentConsent } from './api';

test('keeps room processing purposes separate and binds commands to the server notice version', async () => {
  const authorized = jest.fn(async (request) => request('access-token'));
  const client = {
    GET: jest.fn(async () => ({ data: { items: [
      { purpose: 'ROOM_SAFETY_DETECTION', status: 'REQUIRED', currentNoticeVersion: '2026-09-v1', noticeVersion: null },
      { purpose: 'POST_ROOM_KEYWORDS', status: 'ACCEPTED', currentNoticeVersion: '2026-09-v1', noticeVersion: '2026-09-v1' },
    ] }, response: { status: 200 } })),
    PUT: jest.fn(async () => ({ data: { purpose: 'ROOM_SAFETY_DETECTION', status: 'ACCEPTED', currentNoticeVersion: '2026-09-v1', noticeVersion: '2026-09-v1' }, response: { status: 200 } })),
  };
  const api = new RoomProcessingConsentApi(authorized, client as never);
  const items = await api.list();
  expect(currentConsent(items[0])).toBe(false);
  expect(currentConsent(items[1])).toBe(true);
  expect(currentConsent({ ...items[1]!, currentNoticeVersion: '2026-10-v2' })).toBe(false);
  await api.command('ROOM_SAFETY_DETECTION', 'ACCEPT', items[0]!.currentNoticeVersion, 'request-1');
  expect(client.PUT).toHaveBeenCalledWith('/v1/me/speech-processing-consents/room-safety', { headers: { Authorization: 'Bearer access-token' }, body: { action: 'ACCEPT', noticeVersion: '2026-09-v1', clientRequestId: 'request-1' } });
  await api.command('POST_ROOM_KEYWORDS', 'REVOKE', '2026-09-v1', 'request-2');
  expect(client.PUT).toHaveBeenCalledWith('/v1/me/speech-processing-consents/post-room-keywords', { headers: { Authorization: 'Bearer access-token' }, body: { action: 'REVOKE', noticeVersion: '2026-09-v1', clientRequestId: 'request-2' } });
});
