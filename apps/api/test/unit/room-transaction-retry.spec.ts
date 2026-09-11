import {
  isRetryableRoomTransactionError,
  runRoomTransactionWithRetry,
} from '../../src/modules/rooms/testing.js';

describe('room transaction retry', () => {
  it.each(['P2034', '40001', '40P01'])('recognizes retryable database code %s', (code) => {
    expect(isRetryableRoomTransactionError({ code })).toBe(true);
  });

  it('retries a database conflict and returns the recovered result', async () => {
    let attempts = 0;
    await expect(
      runRoomTransactionWithRetry(async () => {
        attempts += 1;
        if (attempts < 3) throw Object.assign(new Error('retry'), { code: '40001' });
        return 'ok';
      }),
    ).resolves.toBe('ok');
    expect(attempts).toBe(3);
  });

  it('does not retry business errors and enforces the retry limit', async () => {
    let businessAttempts = 0;
    await expect(
      runRoomTransactionWithRetry(async () => {
        businessAttempts += 1;
        throw Object.assign(new Error('room full'), { code: 'ROOM_FULL' });
      }),
    ).rejects.toMatchObject({ code: 'ROOM_FULL' });
    expect(businessAttempts).toBe(1);

    let conflictAttempts = 0;
    await expect(
      runRoomTransactionWithRetry(async () => {
        conflictAttempts += 1;
        throw Object.assign(new Error('deadlock'), { code: '40P01' });
      }, 2),
    ).rejects.toMatchObject({ code: '40P01' });
    expect(conflictAttempts).toBe(2);
  });
});
