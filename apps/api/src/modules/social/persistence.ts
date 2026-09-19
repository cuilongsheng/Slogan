import { createHash, randomUUID } from 'node:crypto';

import { Prisma, type SocialCommandType } from '../../generated/prisma/client.js';
import { SocialError } from './domain/errors/social.error.js';
import { readEffectiveSafetyRestriction } from '../safety/persistence.js';

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function socialPayloadHash(payload: unknown): string {
  return createHash('sha256').update(stable(payload)).digest('hex');
}

export async function lockSocialPair(
  tx: Prisma.TransactionClient,
  leftUserId: string,
  rightUserId: string,
): Promise<[string, string]> {
  if (leftUserId === rightUserId)
    throw new SocialError('SOCIAL_TARGET_UNAVAILABLE', 'Social target is unavailable');
  const pair: [string, string] =
    leftUserId < rightUserId ? [leftUserId, rightUserId] : [rightUserId, leftUserId];
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${pair[0]}:${pair[1]}`}, 0))`,
  );
  return pair;
}

export async function runSocialCommand<T extends Prisma.JsonObject>(
  tx: Prisma.TransactionClient,
  input: {
    actorUserId: string;
    clientRequestId: string;
    type: SocialCommandType;
    payload: Prisma.JsonObject;
  },
  operation: () => Promise<T>,
): Promise<T> {
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${input.actorUserId}:${input.clientRequestId}`}, 0))`,
  );
  const hash = socialPayloadHash(input.payload);
  const previous = await tx.socialCommand.findUnique({
    where: {
      actorUserId_clientRequestId: {
        actorUserId: input.actorUserId,
        clientRequestId: input.clientRequestId,
      },
    },
  });
  if (previous) {
    if (previous.type !== input.type || previous.payloadHash !== hash)
      throw new SocialError(
        'SOCIAL_REQUEST_CONFLICT',
        'Social request identifier was already used',
      );
    return previous.result as T;
  }
  const result = await operation();
  await tx.socialCommand.create({
    data: {
      id: randomUUID(),
      actorUserId: input.actorUserId,
      clientRequestId: input.clientRequestId,
      type: input.type,
      payloadHash: hash,
      result,
    },
  });
  return result;
}

export async function isSocialPairBlocked(
  tx: Prisma.TransactionClient,
  leftUserId: string,
  rightUserId: string,
): Promise<boolean> {
  return (
    (await tx.userBlock.count({
      where: {
        unblockedAt: null,
        OR: [
          { blockerUserId: leftUserId, blockedUserId: rightUserId },
          { blockerUserId: rightUserId, blockedUserId: leftUserId },
        ],
      },
    })) > 0
  );
}

export async function readSocialUserEligible(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date,
): Promise<boolean> {
  const user = await tx.user.findUnique({ where: { id: userId }, include: { profile: true } });
  if (user?.status !== 'ACTIVE' || !user.profile) return false;
  const month = now.getUTCMonth() + 1;
  const age =
    now.getUTCFullYear() - user.profile.birthYear - (month < user.profile.birthMonth ? 1 : 0);
  return age >= 18 && (await readEffectiveSafetyRestriction(tx, userId, now)) === null;
}
