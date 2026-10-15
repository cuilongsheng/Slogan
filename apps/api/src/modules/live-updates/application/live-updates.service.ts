import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../config/environment.js';
import { AppError } from '../../../common/errors/app-error.js';
import { SessionService } from '../../auth/index.js';
import { SocialService } from '../../social/index.js';
import {
  LIVE_UPDATES_STORE,
  type LiveUpdatesStore,
  type StreamPositions,
} from '../domain/live-updates.port.js';

export type LiveFrame = {
  scope: 'reset' | 'heartbeat' | 'renew' | 'rooms' | 'partners' | 'messages';
  id?: string;
};
@Injectable()
export class LiveUpdatesService {
  private publishing: Promise<void> | undefined;
  private pending = false;
  private recoveredAt = 0;
  constructor(
    @Inject(LIVE_UPDATES_STORE) private readonly store: LiveUpdatesStore,
    private readonly sessions: SessionService,
    private readonly social: SocialService,
    private readonly config: ConfigService<Environment, true>,
  ) {}
  recover(): Promise<void> {
    this.pending = true;
    if (this.publishing) return this.publishing;
    this.publishing = Promise.resolve()
      .then(async () => {
        while (this.pending) {
          this.pending = false;
          await this.store.dispatch();
          this.recoveredAt = Date.now();
        }
      })
      .finally(() => {
        this.publishing = undefined;
      });
    return this.publishing;
  }
  expirePresence(owner: string, generation?: string) {
    return this.store.expirePresence(owner, generation);
  }
  private signature(owner: string, body: string) {
    return createHmac('sha256', this.config.get('JWT_ACCESS_SECRET', { infer: true }))
      .update(`live-v1:${owner}:${body}`)
      .digest('base64url');
  }
  private encode(owner: string, positions: StreamPositions) {
    const body = Buffer.from(JSON.stringify([positions, Date.now()])).toString('base64url');
    return `${body}.${this.signature(owner, body)}`;
  }
  private decode(owner: string, cursor?: string): StreamPositions | null {
    if (!cursor) return null;
    if (cursor.length > 512 || !/^[-\w]+\.[-\w]{43}$/.test(cursor))
      throw new AppError('LIVE_CURSOR_INVALID', 'Invalid recovery cursor', 400);
    const [body, signature] = cursor.split('.');
    if (
      !body ||
      !signature ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(this.signature(owner, body)))
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
  async open(token: string, cursor: string | undefined, signal: AbortSignal) {
    const identity = await this.sessions.streamIdentity(token);
    if (await this.sessions.isPublicTrialViewer(identity.userId))
      throw new AppError('LIVE_ACCESS_DENIED', 'Live updates unavailable', 403);
    await this.social.assertEligible(identity.userId);
    const requested = this.decode(identity.userId, cursor);
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
    const deadline = Math.min(Date.now() + 240000, identity.expiresAt - 1000);
    const frames = async function* (this: LiveUpdatesService): AsyncGenerator<LiveFrame> {
      let checkedAt = Date.now();
      try {
        // Reset also requests a fresh snapshot for a retained/replayed cursor. It is duplicate-safe.
        yield { scope: 'reset', id: this.encode(identity.userId, positions) };
        while (!signal.aborted && Date.now() < deadline) {
          if (Date.now() - this.recoveredAt >= 15000) await this.recover();
          const changes = await reader.read(positions);
          if (signal.aborted) break;
          if (changes.length || Date.now() - checkedAt >= 15000) {
            const fresh = await this.sessions.verifyAccessToken(token);
            if (fresh.userId !== identity.userId || fresh.sessionId !== identity.sessionId) break;
            if (await this.sessions.isPublicTrialViewer(identity.userId)) break;
            await this.social.assertEligible(identity.userId);
            checkedAt = Date.now();
            if (!changes.length) yield { scope: 'heartbeat' };
          }
          for (const event of changes) {
            if (Date.now() >= deadline || signal.aborted) break;
            positions[event.index] = event.id;
            yield { scope: event.scope, id: this.encode(identity.userId, positions) };
          }
        }
        if (!signal.aborted) yield { scope: 'renew' };
      } finally {
        reader.close();
      }
    }.bind(this);
    return frames();
  }
}
function compareId(a: string, b: string) {
  const left = a.split('-').map(BigInt),
    right = b.split('-').map(BigInt);
  return left[0] === right[0] ? Number(left[1]! - right[1]!) : left[0]! < right[0]! ? -1 : 1;
}
