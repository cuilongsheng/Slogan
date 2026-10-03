import { MySafetyApi, canAppeal, type Restriction } from './api';

const restriction = {
  id: 'restriction-1',
  severity: 'GENERAL',
  reason: 'Visible reason',
  startsAt: '2026-09-28T08:00:00.000Z',
  endsAt: '2026-09-28T11:00:00.000Z',
  appealDeadlineAt: '2026-09-28T08:30:00.000Z',
  status: 'ACTIVE',
  appealStatus: null,
} as Restriction;

test('shows appeal only during the first active window', () => {
  expect(canAppeal(restriction, new Date('2026-09-28T08:30:00.000Z').getTime())).toBe(true);
  expect(canAppeal(restriction, new Date('2026-09-28T08:30:00.001Z').getTime())).toBe(false);
  expect(canAppeal({ ...restriction, appealStatus: 'PENDING' }, new Date('2026-09-28T08:10:00.000Z').getTime())).toBe(false);
});

test('lists and submits appeals through the authenticated generated client', async () => {
  const authorized = jest.fn(async (request) => request('access-token'));
  const client = {
    GET: jest.fn(async () => ({ data: { items: [restriction], nextCursor: 'page-2' }, response: { status: 200 } })),
    POST: jest.fn(async () => ({ data: { id: 'appeal-1', status: 'PENDING' }, response: { status: 200 } })),
  };
  const api = new MySafetyApi(authorized, client as never);
  expect((await api.list()).nextCursor).toBe('page-2');
  expect((await api.list('page-2')).items).toHaveLength(1);
  expect(client.GET).toHaveBeenLastCalledWith('/v1/me/safety-restrictions', {
    headers: { Authorization: 'Bearer access-token' },
    params: { query: { limit: 20, cursor: 'page-2' } },
  });
  expect((await api.appeal('restriction-1', '  Please review  ', 'request-1')).status).toBe('PENDING');
  expect(client.POST).toHaveBeenCalledWith('/v1/me/safety-restrictions/{restrictionId}/appeal', {
    headers: { Authorization: 'Bearer access-token' },
    params: { path: { restrictionId: 'restriction-1' } },
    body: { reason: 'Please review', clientRequestId: 'request-1' },
  });
});
