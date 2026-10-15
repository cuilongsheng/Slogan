import { availableBatch } from './api';

test('follows empty scan pages before deciding that people are absent', async () => {
  const person = { userId: 'peer', displayName: 'Peer', cefrLevel: 'B1', isAvailable: true };
  const available = jest
    .fn()
    .mockResolvedValueOnce({ items: [], nextCursor: 'offline-page' })
    .mockResolvedValueOnce({ items: [], nextCursor: 'online-page' })
    .mockResolvedValueOnce({ items: [person], nextCursor: 'next' });
  const result = await availableBatch({ available });
  expect(result).toEqual({ page: { items: [person], nextCursor: 'next' }, scannedPages: 3 });
  expect(available.mock.calls).toEqual([[undefined], ['offline-page'], ['online-page']]);
});

test('bounds a scan and preserves its continuation instead of asserting exhaustion', async () => {
  let count = 0;
  const available = jest.fn(async () => ({ items: [], nextCursor: `page-${++count}` }));
  expect(await availableBatch({ available })).toEqual({
    page: { items: [], nextCursor: 'page-10' },
    scannedPages: 10,
  });
  expect(available).toHaveBeenCalledTimes(10);
});

test('stops scanning when focus is lost and rejects a repeated cursor', async () => {
  const available = jest.fn(async () => ({ items: [], nextCursor: 'repeated' }));
  await expect(availableBatch({ available }, undefined, () => false)).rejects.toThrow('cancelled');
  expect(available).not.toHaveBeenCalled();
  await expect(availableBatch({ available }, 'repeated')).rejects.toThrow('did not advance');
});
