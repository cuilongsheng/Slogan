import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../config/environment.js';
import { timelineCursor } from './timeline-cursor.js';
import {
  Prisma,
  type DirectConversation,
  type DirectConversationMember,
  type DirectCall,
} from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { AppError } from '../../../common/errors/app-error.js';
import {
  SOCIAL_PRESENCE,
  type SocialPresence,
  isSocialPairBlocked,
  lockSocialPair,
  readSocialUserEligible,
} from '../../social/index.js';
import { createSafetyCaseForReport } from '../../safety/persistence.js';
import type {
  DirectRepository,
  DirectPageQuery,
  DirectTimelineQuery,
  DirectTimelineEntry,
} from '../domain/direct.js';

type Tx = Prisma.TransactionClient;
const unavailable = () =>
  new AppError('DIRECT_TARGET_UNAVAILABLE', 'This interaction is unavailable', 403);
const missing = () => new AppError('DIRECT_NOT_FOUND', 'Conversation or call was not found', 404);
const busy = () =>
  new AppError('DIRECT_CALL_BUSY', 'A participant is already in a voice session', 409);
const key = (conversationId: string, userId: string) => ({
  conversationId_userId: { conversationId, userId },
});

@Injectable()
export class PrismaDirectRepository implements DirectRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SOCIAL_PRESENCE) private readonly presence: SocialPresence,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  private async lockUsers(tx: Tx, ids: string[]) {
    for (const id of [...new Set(ids)].sort())
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id"=${id}::uuid FOR UPDATE`);
  }
  private async eligible(tx: Tx, actor: string, peer: string) {
    if (
      !(await readSocialUserEligible(tx, actor, new Date())) ||
      !(await readSocialUserEligible(tx, peer, new Date())) ||
      (await isSocialPairBlocked(tx, actor, peer))
    )
      throw unavailable();
  }
  private peerId(row: DirectConversation, actor: string) {
    if (row.userLowId !== actor && row.userHighId !== actor) throw missing();
    return row.userLowId === actor ? row.userHighId : row.userLowId;
  }
  private async member(tx: Tx, actor: string, id: string) {
    const row = await tx.directConversation.findUnique({ where: { id } });
    if (!row) throw missing();
    const peer = this.peerId(row, actor);
    const member = await tx.directConversationMember.findUnique({ where: key(id, actor) });
    if (!member) throw missing();
    if (!(await readSocialUserEligible(tx, actor, new Date()))) throw unavailable();
    return { row, member, peer };
  }
  private async command(
    tx: Tx,
    actor: string,
    requestId: string,
    operation: string,
    payload: Record<string, string | number>,
    apply: () => Promise<Prisma.JsonObject>,
  ) {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`direct-command:${actor}:${requestId}`},0))`,
    );
    const payloadHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const previous = await tx.directCommand.findUnique({
      where: { actorUserId_clientRequestId: { actorUserId: actor, clientRequestId: requestId } },
    });
    if (previous) {
      if (previous.operation !== operation || previous.payloadHash !== payloadHash)
        throw new AppError(
          'DIRECT_REQUEST_CONFLICT',
          'Request identifier was used for another command',
          409,
        );
      return previous.result as Prisma.JsonObject;
    }
    const result = await apply();
    await tx.directCommand.create({
      data: { actorUserId: actor, clientRequestId: requestId, operation, payloadHash, result },
    });
    return result;
  }
  private cursor(scope: string, value?: string) {
    if (!value) return null;
    try {
      const row = JSON.parse(Buffer.from(value, 'base64url').toString()) as {
        scope: string;
        at: string;
        id: string;
        sequence: number;
      };
      if (
        row.scope !== scope ||
        !Number.isSafeInteger(row.sequence) ||
        row.sequence < 0 ||
        (row.at && !Number.isFinite(Date.parse(row.at))) ||
        (row.id && !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(row.id))
      )
        throw new Error();
      return row;
    } catch {
      throw new AppError('DIRECT_CURSOR_INVALID', 'Invalid page cursor', 400);
    }
  }
  private encode(scope: string, data: { at?: string; id?: string; sequence?: number }) {
    return Buffer.from(JSON.stringify({ scope, at: '', id: '', sequence: 0, ...data })).toString(
      'base64url',
    );
  }
  private async project(
    tx: Tx,
    actor: string,
    row: DirectConversation,
    member: DirectConversationMember,
  ) {
    const peerId = this.peerId(row, actor);
    const profile = await tx.userProfile.findUnique({
      where: { userId: peerId },
      select: { userId: true, displayName: true, avatarUrl: true, cefrLevel: true },
    });
    if (!profile) throw missing();
    const lastMessage = await tx.directMessage.findFirst({
      where: { conversationId: row.id, sequence: { gt: member.hiddenThrough } },
      orderBy: { sequence: 'desc' },
    });
    const unreadCount = await tx.directMessage.count({
      where: {
        conversationId: row.id,
        senderUserId: { not: actor },
        sequence: { gt: Math.max(member.hiddenThrough, member.readThrough) },
      },
    });
    const canInteract =
      (await readSocialUserEligible(tx, peerId, new Date())) &&
      !(await isSocialPairBlocked(tx, actor, peerId));
    const lastCall = await tx.directCall.findFirst({
      where: { conversationId: row.id, sequence: { gt: member.hiddenThrough } },
      orderBy: { sequence: 'desc' },
    });
    return {
      id: row.id,
      peer: profile,
      lastMessage,
      lastCall,
      unreadCount,
      lastActivityAt: row.lastActivityAt,
      canInteract,
    };
  }
  async open(actor: string, target: string) {
    if (actor === target) throw unavailable();
    return this.prisma.$transaction(async (tx) => {
      const [userLowId, userHighId] = await lockSocialPair(tx, actor, target);
      await this.eligible(tx, actor, target);
      let row = await tx.directConversation.findUnique({
        where: { userLowId_userHighId: { userLowId, userHighId } },
      });
      if (!row) {
        await tx.$executeRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`direct-open:${actor}`},0))`,
        );
        const friend = await tx.friendship.findFirst({
          where: { userLowId, userHighId, endedAt: null },
        });
        if (!friend) {
          const [opened] = await tx.$queryRaw<Array<{ count: number }>>(
            Prisma.sql`SELECT count(*)::int count FROM "DirectConversation" c WHERE c."initiatorUserId"=${actor}::uuid AND c."createdAt">now()-interval '1 hour' AND NOT EXISTS(SELECT 1 FROM "Friendship" f WHERE f."userLowId"=c."userLowId" AND f."userHighId"=c."userHighId" AND f."endedAt" IS NULL)`,
          );
          if ((opened?.count ?? 0) >= 20)
            throw new AppError('DIRECT_RATE_LIMITED', 'Try again later', 429, {
              retryAfterSeconds: 3600,
            });
        }
        if (
          !friend &&
          (!(await this.presence.online([target])).has(target) ||
            (await tx.roomMembership.count({
              where: {
                userId: target,
                lifecycle: 'ACTIVE',
                room: { status: { in: ['OPEN', 'ENDING'] } },
              },
            })) ||
            (await tx.directCallOccupancy.count({ where: { userId: target } })))
        )
          throw unavailable();
        row = await tx.directConversation.create({
          data: {
            id: randomUUID(),
            userLowId,
            userHighId,
            initiatorUserId: actor,
            participants: { create: [{ userId: actor }, { userId: target }] },
          },
        });
      }
      const member = await tx.directConversationMember.findUniqueOrThrow({
        where: key(row.id, actor),
      });
      return this.project(tx, actor, row, member);
    });
  }
  async detail(actor: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const { row, member } = await this.member(tx, actor, id);
      return this.project(tx, actor, row, member);
    });
  }
  async unreadCount(actor: string): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      if (!(await readSocialUserEligible(tx, actor, new Date()))) throw unavailable();
      const totals = await tx.$queryRaw<Array<{ total: bigint }>>(
        Prisma.sql`SELECT COUNT(*) AS total FROM "DirectMessage" d
          JOIN "DirectConversationMember" m ON m."conversationId" = d."conversationId"
          WHERE m."userId" = ${actor}::uuid AND d."senderUserId" <> ${actor}::uuid
          AND d.sequence > GREATEST(m."hiddenThrough", m."readThrough")`,
      );
      return Math.min(Number(totals[0]?.total ?? 0), Number.MAX_SAFE_INTEGER);
    });
  }
  async conversations(actor: string, query: DirectPageQuery) {
    const scope = `conversations:${actor}`;
    const cursor = this.cursor(scope, query.cursor);
    const limit = query.limit ?? 20;
    if (cursor && (!cursor.at || !cursor.id))
      throw new AppError('DIRECT_CURSOR_INVALID', 'Invalid page cursor', 400);
    return this.prisma.$transaction(async (tx) => {
      if (!(await readSocialUserEligible(tx, actor, new Date()))) throw unavailable();
      const rows = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT c."id" FROM "DirectConversation" c JOIN "DirectConversationMember" m ON m."conversationId"=c."id" WHERE m."userId"=${actor}::uuid AND (EXISTS(SELECT 1 FROM "DirectMessage" dm WHERE dm."conversationId"=c.id AND dm.sequence>m."hiddenThrough") OR EXISTS(SELECT 1 FROM "DirectCall" dc WHERE dc."conversationId"=c.id AND dc.sequence>m."hiddenThrough")) ${cursor ? Prisma.sql`AND (c."lastActivityAt",c."id")<(${new Date(cursor.at)},${cursor.id}::uuid)` : Prisma.empty} ORDER BY c."lastActivityAt" DESC,c."id" DESC LIMIT ${limit + 1}`,
      );
      const items = await Promise.all(
        rows.slice(0, limit).map(async ({ id }) => {
          const { row, member } = await this.member(tx, actor, id);
          return this.project(tx, actor, row, member);
        }),
      );
      const last = items.at(-1);
      return {
        items,
        nextCursor:
          rows.length > limit && last
            ? this.encode(scope, { at: last.lastActivityAt.toISOString(), id: last.id })
            : null,
      };
    });
  }
  async timeline(actor: string, id: string, query: DirectTimelineQuery) {
    if (query.before && query.after)
      throw new AppError(
        'DIRECT_TIMELINE_QUERY_INVALID',
        'Choose older history or newer changes',
        400,
      );
    const limit = query.limit ?? 20;
    if (!Number.isInteger(limit) || limit < 1 || limit > 20)
      throw new AppError(
        'DIRECT_TIMELINE_QUERY_INVALID',
        'Timeline pages contain at most 20 entries',
        400,
      );
    const codec = timelineCursor(this.config.get('JWT_ACCESS_SECRET', { infer: true }), actor, id);
    const before = query.before ? codec.decode(query.before, 'before') : null;
    const after = query.after ? codec.decode(query.after, 'after') : null;
    return this.prisma.$transaction(
      async (tx) => {
        const { row, member } = await this.member(tx, actor, id);
        const watermark = row.nextSequence - 1;
        const anchor = before ? Math.min(before.anchor, watermark) : watermark;
        const lower = Math.max(member.hiddenThrough, after?.sequence ?? 0);
        const [texts, calls] = await Promise.all([
          tx.directMessage.findMany({
            where: {
              conversationId: id,
              sequence: after
                ? { gt: lower, lte: watermark }
                : {
                    gt: member.hiddenThrough,
                    lte: anchor,
                    ...(before ? { lt: before.sequence } : {}),
                  },
            },
            orderBy: { sequence: after ? 'asc' : 'desc' },
            take: limit + 1,
          }),
          tx.directCall.findMany({
            where: {
              conversationId: id,
              sequence: after
                ? { gt: member.hiddenThrough }
                : {
                    gt: member.hiddenThrough,
                    lte: anchor,
                    ...(before ? { lt: before.sequence } : {}),
                  },
              ...(after ? { stateSequence: { gt: after.sequence, lte: watermark } } : {}),
            },
            orderBy: after ? { stateSequence: 'asc' } : { sequence: 'desc' },
            take: limit + 1,
          }),
        ]);
        const all: DirectTimelineEntry[] = [
          ...texts.map((value) => ({ kind: 'text' as const, revision: value.sequence, value })),
          ...calls.map((value) => ({
            kind: 'call' as const,
            revision: value.stateSequence,
            value,
          })),
        ];
        all.sort((a, b) => (after ? a.revision - b.revision : b.value.sequence - a.value.sequence));
        const more = all.length > limit;
        const page = all.slice(0, limit);
        const applied = after && more ? page.at(-1)!.revision : watermark;
        const syncCursor = codec.encode({ mode: 'after', sequence: applied, anchor: watermark });
        const nextBeforeCursor =
          !after && more && page.length
            ? codec.encode({ mode: 'before', sequence: page.at(-1)!.value.sequence, anchor })
            : null;
        return {
          items: page.sort((a, b) => a.value.sequence - b.value.sequence),
          visibleAfterSequence: member.hiddenThrough,
          nextBeforeCursor,
          hasOlder: !!nextBeforeCursor,
          syncCursor,
          nextAfterCursor: after && more ? syncCursor : null,
          hasMoreChanges: !!after && more,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async messages(actor: string, id: string, query: DirectPageQuery) {
    const scope = `messages:${actor}:${id}`;
    const cursor = this.cursor(scope, query.cursor);
    return this.prisma.$transaction(async (tx) => {
      const { member } = await this.member(tx, actor, id);
      const items = await tx.directMessage.findMany({
        where: {
          conversationId: id,
          sequence: { gt: Math.max(member.hiddenThrough, cursor?.sequence ?? 0) },
        },
        orderBy: { sequence: 'asc' },
        take: query.limit ?? 50,
      });
      return {
        items,
        visibleAfterSequence: member.hiddenThrough,
        nextCursor: this.encode(scope, {
          sequence: items.at(-1)?.sequence ?? Math.max(member.hiddenThrough, cursor?.sequence ?? 0),
        }),
      };
    });
  }
  async send(actor: string, id: string, text: string, requestId: string) {
    return this.prisma.$transaction(async (tx) => {
      const { row, peer } = await this.member(tx, actor, id);
      await lockSocialPair(tx, actor, peer);
      await this.eligible(tx, actor, peer);
      const result = await this.command(tx, actor, requestId, 'SEND', { id, text }, async () => {
        // Serialize each sender's allowance as well as the conversation order.
        await tx.$executeRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`direct-sender:${actor}`},0))`,
        );
        const recent = await tx.directMessage.count({
          where: { senderUserId: actor, createdAt: { gt: new Date(Date.now() - 60_000) } },
        });
        if (recent >= 30)
          throw new AppError('DIRECT_RATE_LIMITED', 'Please wait before sending again', 429, {
            retryAfterSeconds: 60,
          });
        const friend = await tx.friendship.findFirst({
          where: { userLowId: row.userLowId, userHighId: row.userHighId, endedAt: null },
        });
        if (!friend) {
          const sent = await tx.directMessage.count({
            where: { conversationId: id, senderUserId: actor, sequence: { gt: 0 } },
          });
          const reply = await tx.directMessage.findFirst({
            where: { conversationId: id, senderUserId: peer },
          });
          if (!reply && sent >= 3)
            throw new AppError(
              'DIRECT_RATE_LIMITED',
              'Wait for a reply before sending more messages',
              429,
            );
          const strangers = await tx.$queryRaw<Array<{ conversationId: string }>>(
            Prisma.sql`SELECT DISTINCT m."conversationId" FROM "DirectMessage" m JOIN "DirectConversation" c ON c.id=m."conversationId" WHERE m."senderUserId"=${actor}::uuid AND m."createdAt">now()-interval '1 hour' AND NOT EXISTS(SELECT 1 FROM "Friendship" f WHERE f."userLowId"=c."userLowId" AND f."userHighId"=c."userHighId" AND f."endedAt" IS NULL) LIMIT 21`,
          );
          if (!strangers.some((x) => x.conversationId === id) && strangers.length >= 20)
            throw new AppError(
              'DIRECT_RATE_LIMITED',
              'Please wait before starting more conversations',
              429,
              { retryAfterSeconds: 3600 },
            );
        }
        const updated = await tx.directConversation.update({
          where: { id },
          data: { nextSequence: { increment: 1 }, lastActivityAt: new Date() },
        });
        const message = await tx.directMessage.create({
          data: {
            id: randomUUID(),
            conversationId: id,
            senderUserId: actor,
            clientRequestId: requestId,
            sequence: updated.nextSequence - 1,
            text,
          },
        });
        return { messageId: message.id };
      });
      return tx.directMessage.findUniqueOrThrow({ where: { id: String(result.messageId) } });
    });
  }
  async read(actor: string, id: string, sequence: number) {
    await this.prisma.$transaction(async (tx) => {
      const { row, peer } = await this.member(tx, actor, id);
      await lockSocialPair(tx, actor, peer);
      const last = Math.min(sequence, row.nextSequence - 1);
      await tx.directConversationMember.updateMany({
        where: { conversationId: id, userId: actor, readThrough: { lt: last } },
        data: { readThrough: last },
      });
    });
  }
  async hide(actor: string, id: string, requestId: string) {
    await this.prisma.$transaction(async (tx) => {
      const { peer } = await this.member(tx, actor, id);
      await lockSocialPair(tx, actor, peer);
      await this.command(tx, actor, requestId, 'HIDE', { id }, async () => {
        const row = await tx.directConversation.findUniqueOrThrow({ where: { id } });
        await tx.directConversationMember.update({
          where: key(id, actor),
          data: { hiddenThrough: row.nextSequence - 1, readThrough: row.nextSequence - 1 },
        });
        return { id };
      });
    });
  }
  async report(
    actor: string,
    id: string,
    messageId: string,
    category: string,
    description: string,
    requestId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const { member, peer } = await this.member(tx, actor, id);
      await lockSocialPair(tx, actor, peer);
      const message = await tx.directMessage.findFirst({
        where: {
          id: messageId,
          conversationId: id,
          senderUserId: peer,
          sequence: { gt: member.hiddenThrough },
        },
      });
      if (!message) throw missing();
      const result = await this.command(
        tx,
        actor,
        requestId,
        'REPORT',
        { id, messageId, category, description },
        async () => {
          const report = await tx.report.create({
            data: {
              id: randomUUID(),
              reporterUserId: actor,
              targetUserId: peer,
              clientRequestId: requestId,
              directMessageId: messageId,
              category: category as 'HARASSMENT_ABUSE',
              description,
            },
          });
          const caseId = await createSafetyCaseForReport(tx, {
            reportId: report.id,
            roomId: null,
            targetUserId: peer,
            submittedAt: report.submittedAt,
          });
          return { id: report.id, caseId };
        },
      );
      const report = await tx.report.findUniqueOrThrow({ where: { id: String(result.id) } });
      return { id: report.id, caseId: String(result.caseId), submittedAt: report.submittedAt };
    });
  }
  private async outsideVoice(tx: Tx, userId: string) {
    if (
      await tx.roomMembership.count({
        where: { userId, lifecycle: 'ACTIVE', room: { status: { in: ['OPEN', 'ENDING'] } } },
      })
    )
      throw busy();
  }
  async callHistory(actor: string, id: string, query: DirectPageQuery) {
    const scope = `calls:${actor}:${id}`;
    const cursor = this.cursor(scope, query.cursor);
    return this.prisma.$transaction(async (tx) => {
      const { member } = await this.member(tx, actor, id);
      const items = await tx.directCall.findMany({
        where: {
          conversationId: id,
          sequence: { gt: member.hiddenThrough },
          stateSequence: { gt: cursor?.sequence ?? 0 },
        },
        orderBy: { stateSequence: 'asc' },
        take: query.limit ?? 50,
      });
      const last = items.at(-1);
      return {
        items,
        visibleAfterSequence: member.hiddenThrough,
        nextCursor: last
          ? this.encode(scope, { sequence: last.stateSequence })
          : (query.cursor ?? null),
      };
    });
  }

  async requestCall(actor: string, id: string, requestId: string) {
    return this.prisma.$transaction(async (tx) => {
      const { peer } = await this.member(tx, actor, id);
      await this.lockUsers(tx, [actor, peer]);
      await lockSocialPair(tx, actor, peer);
      await this.eligible(tx, actor, peer);
      const result = await this.command(tx, actor, requestId, 'CALL_REQUEST', { id }, async () => {
        if (!(await this.presence.online([actor, peer])).has(peer)) throw unavailable();
        await this.outsideVoice(tx, actor);
        await this.outsideVoice(tx, peer);
        if (await tx.directCallOccupancy.count({ where: { userId: { in: [actor, peer] } } }))
          throw busy();
        const updated = await tx.directConversation.update({
          where: { id },
          data: { nextSequence: { increment: 1 }, lastActivityAt: new Date() },
        });
        const call = await tx.directCall.create({
          data: {
            id: randomUUID(),
            conversationId: id,
            sequence: updated.nextSequence - 1,
            stateSequence: updated.nextSequence - 1,
            callerUserId: actor,
            calleeUserId: peer,
            expiresAt: new Date(Date.now() + 30_000),
            occupancy: { create: [{ userId: actor }, { userId: peer }] },
          },
        });
        return { id: call.id };
      });
      return tx.directCall.findUniqueOrThrow({ where: { id: String(result.id) } });
    });
  }
  private async checkedCall(tx: Tx, actor: string, id: string) {
    const row = await tx.directCall.findUnique({ where: { id } });
    if (!row || ![row.callerUserId, row.calleeUserId].includes(actor)) throw missing();
    await this.lockUsers(tx, [row.callerUserId, row.calleeUserId]);
    await lockSocialPair(tx, row.callerUserId, row.calleeUserId);
    const current = await tx.directCall.findUniqueOrThrow({ where: { id } });
    if (current.status === 'RINGING' && current.expiresAt <= new Date())
      return this.terminate(tx, current, 'EXPIRED', 'TIMEOUT');
    if (['RINGING', 'ACTIVE'].includes(current.status)) {
      const valid =
        (await readSocialUserEligible(tx, current.callerUserId, new Date())) &&
        (await readSocialUserEligible(tx, current.calleeUserId, new Date())) &&
        !(await isSocialPairBlocked(tx, current.callerUserId, current.calleeUserId));
      if (!valid) return this.terminate(tx, current, 'ENDED', 'UNAVAILABLE');
      if (
        current.status === 'ACTIVE' &&
        ((current.callerHeartbeatAt ?? current.acceptedAt ?? current.createdAt).getTime() <
          Date.now() - 60_000 ||
          (current.calleeHeartbeatAt ?? current.acceptedAt ?? current.createdAt).getTime() <
            Date.now() - 60_000)
      )
        return this.terminate(tx, current, 'ENDED', 'DISCONNECTED');
    }
    return current;
  }
  private async terminate(tx: Tx, call: DirectCall, status: string, endReason: string) {
    const revision = await tx.directConversation.update({
      where: { id: call.conversationId },
      data: { nextSequence: { increment: 1 }, lastActivityAt: new Date() },
    });
    const row = await tx.directCall.update({
      where: { id: call.id },
      data: {
        stateSequence: revision.nextSequence - 1,
        status,
        endReason,
        endedAt: new Date(),
        cleanupStatus:
          call.status === 'ACTIVE' || call.credentialExpiresAt ? 'PENDING' : call.cleanupStatus,
        cleanupNextAt: new Date(),
      },
    });
    await tx.directCallOccupancy.deleteMany({ where: { callId: call.id } });
    return row;
  }
  async call(actor: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.checkedCall(tx, actor, id);
      const peerId = row.callerUserId === actor ? row.calleeUserId : row.callerUserId;
      const peer = await tx.userProfile.findUniqueOrThrow({
        where: { userId: peerId },
        select: { userId: true, displayName: true, avatarUrl: true, cefrLevel: true },
      });
      return { ...row, peer };
    });
  }
  async calls(actor: string) {
    if (!(await readSocialUserEligible(this.prisma, actor, new Date()))) throw unavailable();
    const rows = await this.prisma.directCall.findMany({
      where: {
        OR: [{ callerUserId: actor }, { calleeUserId: actor }],
        status: { in: ['RINGING', 'ACTIVE'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const checked = [];
    for (const row of rows) checked.push(await this.call(actor, row.id));
    return checked;
  }
  async actCall(actor: string, id: string, action: 'accept' | 'reject' | 'end', requestId: string) {
    // Persist expiration and eligibility invalidation before a rejected command rolls back.
    await this.call(actor, id);
    return this.prisma.$transaction(async (tx) => {
      const row = await this.checkedCall(tx, actor, id);
      const result = await this.command(
        tx,
        actor,
        requestId,
        `CALL_${action}`,
        { id },
        async () => {
          if (action === 'accept') {
            if (actor !== row.calleeUserId || row.status !== 'RINGING')
              throw new AppError('DIRECT_CALL_UNAVAILABLE', 'Call cannot be accepted', 409);
            await this.eligible(tx, row.callerUserId, row.calleeUserId);
            await this.outsideVoice(tx, row.callerUserId);
            await this.outsideVoice(tx, row.calleeUserId);
            const online = await this.presence.online([row.callerUserId, row.calleeUserId]);
            if (online.size !== 2) throw unavailable();
            const revision = await tx.directConversation.update({
              where: { id: row.conversationId },
              data: { nextSequence: { increment: 1 }, lastActivityAt: new Date() },
            });
            await tx.directCall.update({
              where: { id },
              data: {
                stateSequence: revision.nextSequence - 1,
                status: 'ACTIVE',
                acceptedAt: new Date(),
                callerHeartbeatAt: new Date(),
                calleeHeartbeatAt: new Date(),
              },
            });
          } else {
            if (action === 'reject' && (actor !== row.calleeUserId || row.status !== 'RINGING'))
              throw new AppError('DIRECT_CALL_UNAVAILABLE', 'Call cannot be rejected', 409);
            if (['ACTIVE', 'RINGING'].includes(row.status))
              await this.terminate(
                tx,
                row,
                action === 'reject' ? 'REJECTED' : 'ENDED',
                action === 'reject' ? 'DECLINED' : 'HANGUP',
              );
          }
          return { id };
        },
      );
      return tx.directCall.findUniqueOrThrow({ where: { id: String(result.id) } });
    });
  }
  async heartbeat(actor: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.checkedCall(tx, actor, id);
      if (row.status !== 'ACTIVE') return row;
      return tx.directCall.update({
        where: { id },
        data:
          row.callerUserId === actor
            ? { callerHeartbeatAt: new Date() }
            : { calleeHeartbeatAt: new Date() },
      });
    });
  }
  async reserveCredentials(actor: string, id: string, expiresAt: Date) {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.checkedCall(tx, actor, id);
      if (row.status !== 'ACTIVE') return false;
      if (!row.credentialExpiresAt || row.credentialExpiresAt < expiresAt)
        await tx.directCall.update({ where: { id }, data: { credentialExpiresAt: expiresAt } });
      return true;
    });
  }
  async rescheduleCleanup(id: string) {
    await this.prisma.directCall.updateMany({
      where: { id, status: { not: 'ACTIVE' } },
      data: {
        cleanupStatus: 'PENDING',
        cleanupNextAt: new Date(),
        cleanupGeneration: { increment: 1 },
        cleanupLeaseId: null,
        cleanupLockedUntil: null,
      },
    });
  }
  async expireAndClaimCleanup() {
    const now = new Date(),
      stale = new Date(Date.now() - 60_000);
    // Prioritize timed-out sessions, then rotate through healthy sessions to detect eligibility changes.
    const due = await this.prisma.directCall.findMany({
      where: {
        OR: [
          { status: 'RINGING', expiresAt: { lte: now } },
          {
            status: 'ACTIVE',
            OR: [{ callerHeartbeatAt: { lt: stale } }, { calleeHeartbeatAt: { lt: stale } }],
          },
        ],
      },
      orderBy: { expiresAt: 'asc' },
      take: 100,
    });
    for (const row of due)
      await this.prisma.$transaction((tx) => this.checkedCall(tx, row.callerUserId, row.id));
    const scan = await this.prisma.managedMaintenanceLease.upsert({
      where: { key: 'direct-eligibility-scan' },
      create: { key: 'direct-eligibility-scan' },
      update: {},
    });
    const active = await this.prisma.directCall.findMany({
      where: {
        status: { in: ['RINGING', 'ACTIVE'] },
        ...(scan.scanCursor ? { id: { gt: scan.scanCursor } } : {}),
      },
      orderBy: { id: 'asc' },
      take: 100,
    });
    for (const row of active)
      await this.prisma.$transaction((tx) => this.checkedCall(tx, row.callerUserId, row.id));
    await this.prisma.managedMaintenanceLease.update({
      where: { key: scan.key },
      data: { scanCursor: active.length === 100 ? active.at(-1)!.id : null },
    });
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "DirectCall" WHERE "cleanupStatus"='PENDING' AND "cleanupNextAt"<=now() AND ("cleanupLockedUntil" IS NULL OR "cleanupLockedUntil"<now()) ORDER BY "cleanupNextAt" LIMIT 20 FOR UPDATE SKIP LOCKED`,
      );
      const claimed = [];
      for (const row of rows) {
        const leaseId = randomUUID();
        const updated = await tx.directCall.update({
          where: { id: row.id },
          data: {
            cleanupLeaseId: leaseId,
            cleanupGeneration: { increment: 1 },
            cleanupAttempts: { increment: 1 },
            cleanupLockedUntil: new Date(Date.now() + 315_000),
          },
        });
        claimed.push({
          id: row.id,
          leaseId,
          generation: updated.cleanupGeneration,
          callerUserId: updated.callerUserId,
          calleeUserId: updated.calleeUserId,
          credentialExpiresAt: updated.credentialExpiresAt,
        });
      }
      return claimed;
    });
  }
  async finishCleanup(id: string, leaseId: string, generation: number, success: boolean) {
    await this.prisma.directCall.updateMany({
      where: { id, cleanupLeaseId: leaseId, cleanupGeneration: generation },
      data: {
        cleanupStatus: success ? 'DONE' : 'PENDING',
        cleanupLeaseId: null,
        cleanupLockedUntil: null,
        cleanupNextAt: new Date(Date.now() + 30_000),
      },
    });
  }
}
