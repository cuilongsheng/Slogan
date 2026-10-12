import { fn } from 'jest-mock';
import { SocialService } from '../../src/modules/social/application/services/social.service.js';
import type { SocialRepository } from '../../src/modules/social/domain/ports/social.repository.js';
import type { SocialPresence } from '../../src/modules/social/domain/ports/presence.port.js';
import { decodeSocialCursor } from '../../src/modules/social/application/social-cursor.js';

const now = new Date('2026-10-12T00:00:00Z');
const candidates = Array.from({ length: 8 }, (_, index) => ({
  userId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  createdAt: new Date(now.getTime() - index * 1000),
  displayName: `Person ${index}`,
  avatarUrl: null,
  nationalityCode: 'CN',
  cefrLevel: 'B1',
}));
function setup(onlineIds: string[]) {
  const repository = {
    assertActorEligible: fn(async () => undefined),
    listAvailableCandidates: fn(async ({ cursor }: { cursor: { id: string } | null }) => {
      const start = cursor ? candidates.findIndex((item) => item.userId === cursor.id) + 1 : 0;
      const items = candidates.slice(start, start + 4);
      const last = items.at(-1);
      return {
        items,
        nextCursor:
          start + 4 < candidates.length && last
            ? { createdAt: last.createdAt, id: last.userId }
            : null,
      };
    }),
  };
  const presence = {
    refresh: fn(async (_id: string) => ({ expiresAt: now, refreshAfterSeconds: 45 })),
    online: fn(async (ids: string[]) => new Set(ids.filter((id) => onlineIds.includes(id)))),
  };
  return {
    service: new SocialService(
      repository as unknown as SocialRepository,
      presence as unknown as SocialPresence,
    ),
    repository,
    presence,
  };
}

describe('available people pagination', () => {
  it('renews only the querying actor and reports refresh failure instead of false offline peers', async () => {
    const { service, presence } = setup([]);
    await service.listAvailable('actor', {}, now);
    expect(presence.refresh).toHaveBeenCalledWith('actor');
    expect(presence.refresh).toHaveBeenCalledTimes(1);
    presence.refresh.mockRejectedValue(
      Object.assign(new Error('Unavailable'), { code: 'SOCIAL_PRESENCE_UNAVAILABLE' }),
    );
    await expect(service.listAvailable('actor', {}, now)).rejects.toMatchObject({
      code: 'SOCIAL_PRESENCE_UNAVAILABLE',
    });
  });
  it('preserves all online candidates across scanned-page boundaries', async () => {
    const { service } = setup(candidates.map((item) => item.userId));
    let cursor: string | undefined;
    const seen: string[] = [];
    do {
      const page = await service.listAvailable(
        'actor',
        { limit: 2, ...(cursor ? { cursor } : {}) },
        now,
      );
      seen.push(...page.items.map((item) => item.userId));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(seen).toEqual(candidates.map((item) => item.userId));
  });
  it('scans past offline candidates before showing an empty result', async () => {
    const { service, repository } = setup([candidates[6]!.userId]);
    const page = await service.listAvailable('actor', { limit: 2 }, now);
    expect(page.items.map((item) => item.userId)).toEqual([candidates[6]!.userId]);
    expect(page.nextCursor).toBeNull();
    expect(repository.listAvailableCandidates).toHaveBeenCalledTimes(2);
  });
  it('returns a resumable cursor when the bounded scan has not exhausted candidates', async () => {
    const { service, repository } = setup([]);
    const last = candidates[3]!;
    repository.listAvailableCandidates.mockResolvedValue({
      items: candidates.slice(0, 4),
      nextCursor: { createdAt: last.createdAt, id: last.userId },
    });
    const page = await service.listAvailable('actor', { limit: 2 }, now);
    expect(page.items).toEqual([]);
    expect(repository.listAvailableCandidates).toHaveBeenCalledTimes(5);
    expect(decodeSocialCursor('available', page.nextCursor!)).toEqual({
      createdAt: last.createdAt,
      id: last.userId,
    });
  });
  it('surfaces unavailable presence instead of a false empty list', async () => {
    const { service, presence } = setup([]);
    presence.online.mockRejectedValue(
      Object.assign(new Error('Unavailable'), { code: 'SOCIAL_PRESENCE_UNAVAILABLE' }),
    );
    await expect(service.listAvailable('actor', {}, now)).rejects.toMatchObject({
      code: 'SOCIAL_PRESENCE_UNAVAILABLE',
    });
  });
});
