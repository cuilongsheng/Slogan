import { Prisma } from '../../../generated/prisma/client.js';

export function isRetryableRoomTransactionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') return true;
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  return ['P2034', '40001', '40P01'].includes(String(error.code));
}

export async function runRoomTransactionWithRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableRoomTransactionError(error) || attempt === maxAttempts) throw error;
    }
  }
  throw lastError;
}
