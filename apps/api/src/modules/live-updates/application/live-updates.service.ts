import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../config/environment.js';
import { AppError } from '../../../common/errors/app-error.js';
import { SessionService, type VerifiedAccessContext } from '../../auth/index.js';
import { SocialService, SocialError } from '../../social/index.js';
import {
  LIVE_UPDATES_STORE,
  type LiveUpdatesStore,
  type StreamPositions,
  type LiveScope,
  type StreamChange,
} from '../domain/live-updates.port.js';

export type LiveFrame = {
  scope: 'ready' | 'reset' | 'heartbeat' | 'renew' | LiveScope;
  resourceId?: string;
  kind?: 'membership' | 'visibility';
  id?: string;
};
@Injectable()
export class LiveUpdatesService {
  private publishing: Promise<void> | undefined;
  private pending = false;
  constructor(
    @Inject(LIVE_UPDATES_STORE) private readonly store: LiveUpdatesStore,
    private readonly sessions: SessionService,
    private readonly social: SocialService,
    private readonly config: ConfigService<Environment, true>,
  ) {}
  async sweepPresence() {
    return this.store.sweepPresence?.();
  }
  reconcileRelease() {
    return this.store.reconcileRelease();
  }
  recover(): Promise<void> {
    this.pending = true;
    if (this.publishing) return this.publishing;
    this.publishing = Promise.resolve()
      .then(async () => {
        while (this.pending) {
          this.pending = false;
          await this.store.dispatch();
        }
      })
      .finally(() => {
        this.publishing = undefined;
      });
    return this.publishing;
  }
  async presenceExpiry(owner: string, generation: string) {
    if (this.store.presenceExpiry) return this.store.presenceExpiry(owner, generation);
    const ttl = await this.store.expirePresence(owner, generation);
    return { ttl, expiresAt: Date.now() + ttl };
  }
  expirePresence(owner: string, generation?: string) {
    return this.store.expirePresence(owner, generation);
  }
  private signature(owner: string, body: string, protocol = 1) {
    return createHmac('sha256', this.config.get('JWT_ACCESS_SECRET', { infer: true }))
      .update(`live-v${protocol}:${owner}:${body}`)
      .digest('base64url');
  }
  private encode(owner: string, positions: StreamPositions, protocol = 1) {
    const body = Buffer.from(JSON.stringify([positions, Date.now()])).toString('base64url');
    return `${body}.${this.signature(owner, body, protocol)}`;
  }
  private decode(owner: string, cursor?: string, protocol = 1): StreamPositions | null {
    if (!cursor) return null;
    if (cursor.length > 512 || !/^[-\w]+\.[-\w]{43}$/.test(cursor))
      throw new AppError('LIVE_CURSOR_INVALID', 'Invalid recovery cursor', 400);
    const [body, signature] = cursor.split('.');
    if (
      !body ||
      !signature ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(this.signature(owner, body, protocol)))
    )
      throw new AppError('LIVE_CURSOR_INVALID', 'Invalid recovery cursor', 400);
    try {
      const [positions, issued] = JSON.parse(
        Buffer.from(body, 'base64url').toString(),
      ) as unknown[];
      if (
        !Array.isArray(positions) ||
        positions.length !== 2 ||
        !positions.every((p) => typeof p === 'string' && /^\d{1,16}-\d{1,16}$/.test(p)) ||
        typeof issued !== 'number'
      )
        throw new Error();
      return Date.now() - issued > 900000 ? null : (positions as StreamPositions);
    } catch {
      throw new AppError('LIVE_CURSOR_INVALID', 'Invalid recovery cursor', 400);
    }
  }
  private async eligible(owner: string) {
    try {
      await this.social.assertEligible(owner);
      return true;
    } catch (error) {
      if (error instanceof SocialError && error.code === 'SOCIAL_ACCESS_RESTRICTED') return false;
      throw error;
    }
  }
  async open(
    token: string,
    cursor: string | undefined,
    signal: AbortSignal,
    protocol = 1,
    verified?: VerifiedAccessContext,
  ) {
    if (protocol !== 1 && protocol !== 2)
      throw new AppError('LIVE_PROTOCOL_INVALID', 'Unsupported live protocol', 400);
    const identity = await this.sessions.streamIdentity(token, verified);
    if (identity.trial ?? (await this.sessions.isPublicTrialViewer(identity.userId)))
      throw new AppError('LIVE_ACCESS_DENIED', 'Live updates unavailable', 403);
    const initialEligible = identity.eligible ?? (await this.eligible(identity.userId));
    if (protocol === 1 && !initialEligible)
      throw new SocialError('SOCIAL_ACCESS_RESTRICTED', 'Social access is restricted');
    const requested = this.decode(identity.userId, cursor, protocol);
    // One bounded preflight on connection entry establishes replay bounds after prior commits.
    // No periodic global recovery is performed by an open stream.
    try {
      await this.recover();
    } catch {
      throw new AppError('LIVE_UPDATES_UNAVAILABLE', 'Live updates temporarily unavailable', 503);
    }
    const bounds = await this.store.bounds(identity.userId).catch(() => {
      throw new AppError('LIVE_UPDATES_UNAVAILABLE', 'Live updates temporarily unavailable', 503);
    });
    const replay =
      requested &&
      requested.every(
        (p, i) =>
          p === '0-0' ||
          (compareId(p, bounds.first[i]!) >= 0 && compareId(p, bounds.last[i]!) <= 0),
      );
    const positions: StreamPositions = replay ? [...requested] : [...bounds.last];
    const reader = await this.store.reader(identity.userId, signal).catch(() => {
      throw new AppError('LIVE_UPDATES_UNAVAILABLE', 'Live updates temporarily unavailable', 503);
    });
    // Align checkpoints and bounded renewals across subscribers sharing one reader.
    // Otherwise staggered per-user deadlines turn one reader into N idle wakeups.
    const deadline = Math.min(
      (Math.floor(Date.now() / 240000) + 1) * 240000,
      identity.expiresAt - 1000,
    );
    const frames = async function* (this: LiveUpdatesService): AsyncGenerator<LiveFrame> {
      let checkedAt = Math.floor(Date.now() / 15000) * 15000;
      try {
        let eligible = initialEligible;
        // Reset also requests a fresh snapshot for a retained/replayed cursor. It is duplicate-safe.
        yield {
          scope: protocol === 2 && replay ? 'ready' : 'reset',
          id: this.encode(identity.userId, positions, protocol),
        };
        while (!signal.aborted && Date.now() < deadline) {
          const changes = await reader.read(positions, Math.min(deadline, checkedAt + 15000));
          if (signal.aborted || Date.now() >= deadline) break;
          if (changes.length || Date.now() - checkedAt >= 15000) {
            const fresh = this.sessions.recheckAccessContext
              ? await this.sessions.recheckAccessContext(identity)
              : await this.sessions.verifyAccessToken(token);
            if (fresh.userId !== identity.userId || fresh.sessionId !== identity.sessionId) break;
            const state = fresh as VerifiedAccessContext;
            if (state.trial ?? (await this.sessions.isPublicTrialViewer(identity.userId))) break;
            eligible = state.eligible ?? (await this.eligible(identity.userId));
            if (protocol === 1 && !eligible)
              throw new SocialError('SOCIAL_ACCESS_RESTRICTED', 'Social access is restricted');
            checkedAt = Math.floor(Date.now() / 15000) * 15000;
            if (!changes.length) yield { scope: 'heartbeat' };
          }
          // These are snapshot invalidations. Keep the last identical notification in this
          // bounded read, so a message burst cannot turn into hundreds of permission queries.
          // Last-occurrence ordering preserves replay positions; permissions are still checked
          // immediately before each retained delivery, never cached across reads.
          const latest = new Map<string, string>();
          if (protocol === 2) for (const event of changes) latest.set(changeKey(event), event.id);
          for (const event of changes) {
            if (Date.now() >= deadline || signal.aborted) break;
            positions[event.index] = event.id;
            if (protocol === 2 && latest.get(changeKey(event)) !== event.id) continue;
            if (protocol === 1) {
              if (['rooms', 'partners', 'messages'].includes(event.scope))
                yield { scope: event.scope, id: this.encode(identity.userId, positions, protocol) };
              continue;
            }
            if (event.scope === 'messages') continue; // Legacy broad invalidations have typed counterparts.
            const selfService =
              ['account', 'safety', 'reports', 'learning', 'release', 'calls'].includes(
                event.scope,
              ) ||
              (event.scope === 'room-state' && event.kind === 'membership');
            if (
              (!eligible && !selfService) ||
              !(await this.store.canReceive(identity.userId, event))
            )
              continue;
            yield {
              scope: event.scope,
              ...(event.resourceId ? { resourceId: event.resourceId } : {}),
              ...(event.kind ? { kind: event.kind } : {}),
              id: this.encode(identity.userId, positions, protocol),
            };
          }
        }
        if (!signal.aborted)
          yield {
            scope: 'renew',
            ...(protocol === 2 ? { id: this.encode(identity.userId, positions, protocol) } : {}),
          };
      } finally {
        reader.close();
      }
    }.bind(this);
    return frames();
  }
}
function changeKey(event: StreamChange) {
  return `${event.index}:${event.scope}:${event.resourceId ?? ''}:${event.kind ?? ''}`;
}
function compareId(a: string, b: string) {
  const left = a.split('-').map(BigInt),
    right = b.split('-').map(BigInt);
  return left[0] === right[0] ? Number(left[1]! - right[1]!) : left[0]! < right[0]! ? -1 : 1;
}
