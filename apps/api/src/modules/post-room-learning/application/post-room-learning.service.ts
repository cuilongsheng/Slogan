import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppError } from '../../../common/errors/app-error.js';
import type { Environment } from '../../../config/environment.js';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service.js';
import {
  ROOM_SPEECH_COORDINATOR,
  RoomSpeechSafetyService,
  type RoomSpeechCoordinator,
} from '../../speech-safety/index.js';
import type { RoomKeywordItemKind } from '../domain/entities/post-room-learning.js';
import { PostRoomLearningError } from '../domain/errors/post-room-learning.error.js';
import { KeywordCandidatePolicy } from '../domain/policies/keyword-candidate.policy.js';
import {
  KEYWORD_CANDIDATE_STORE,
  type KeywordCandidateStore,
} from '../domain/ports/keyword-candidate-store.port.js';
import {
  POST_ROOM_LEARNING_REPOSITORY,
  type PostRoomLearningRepository,
  type VocabularyCursor,
} from '../domain/ports/post-room-learning.repository.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class PostRoomLearningService {
  private readonly candidateBackoffUntil = new Map<string, number>();

  constructor(
    @Inject(POST_ROOM_LEARNING_REPOSITORY)
    private readonly repository: PostRoomLearningRepository,
    @Inject(KEYWORD_CANDIDATE_STORE) private readonly candidates: KeywordCandidateStore,
    @Inject(ROOM_SPEECH_COORDINATOR) private readonly coordinator: RoomSpeechCoordinator,
    private readonly safety: RoomSpeechSafetyService,
    private readonly policy: KeywordCandidatePolicy,
    private readonly config: ConfigService<Environment, true>,
    private readonly logger: StructuredLogger,
  ) {}

  async consumeTranscript(input: { roomId: string; transcript: string; fencingToken: string }) {
    const now = Date.now();
    const backoffUntil = this.candidateBackoffUntil.get(input.roomId);
    if (backoffUntil && backoffUntil > now) return { candidateCount: 0 };
    if (backoffUntil) this.candidateBackoffUntil.delete(input.roomId);

    let extracted: ReturnType<KeywordCandidatePolicy['extract']>;
    try {
      extracted = this.policy.extract(
        input.transcript,
        this.config.get('POST_ROOM_KEYWORDS_EXTRACTOR_VERSION', { infer: true }),
      );
      await this.safety.recoverIncident({
        roomId: input.roomId,
        component: 'KEYWORD_CANDIDATE_EXTRACTION',
        errorCategory: 'CANDIDATE_EXTRACTION_FAILED',
        now: new Date(),
      });
    } catch {
      this.backoffCandidates(input.roomId, now);
      await this.safety.degrade(
        input.roomId,
        'KEYWORD_CANDIDATE_EXTRACTION',
        'CANDIDATE_EXTRACTION_FAILED',
      );
      return { candidateCount: 0 };
    }
    if (!extracted.length) return { candidateCount: 0 };
    try {
      await this.candidates.append({
        roomId: input.roomId,
        fencingToken: input.fencingToken,
        candidates: extracted,
        ttlSeconds: this.config.get('POST_ROOM_KEYWORDS_CANDIDATE_TTL_SECONDS', { infer: true }),
        maxKeywords: this.config.get('POST_ROOM_KEYWORDS_MAX_KEYWORDS', { infer: true }),
        maxExpressions: this.config.get('POST_ROOM_KEYWORDS_MAX_EXPRESSIONS', { infer: true }),
      });
      await this.safety.recoverIncident({
        roomId: input.roomId,
        component: 'KEYWORD_CANDIDATE_STORE',
        errorCategory: 'CANDIDATE_STORE_UNAVAILABLE',
        now: new Date(),
      });
    } catch (error) {
      this.backoffCandidates(input.roomId, now);
      await this.safety.degrade(
        input.roomId,
        'KEYWORD_CANDIDATE_STORE',
        'CANDIDATE_STORE_UNAVAILABLE',
      );
      throw error;
    }
    this.candidateBackoffUntil.delete(input.roomId);
    return { candidateCount: extracted.length };
  }

  private backoffCandidates(roomId: string, now: number) {
    this.candidateBackoffUntil.set(
      roomId,
      now + Math.max(1_000, this.config.get('ROOM_SPEECH_WINDOW_MS', { infer: true })),
    );
  }

  getSummary(userId: string, roomId: string) {
    return this.repository.summary(roomId, userId);
  }

  async reconcileFinalization(now = new Date()) {
    await this.repository.queueEnded(
      now,
      this.config.get('POST_ROOM_KEYWORDS_JOB_DEADLINE_SECONDS', { infer: true }),
    );
    for (const job of await this.repository.claimJobs(
      now,
      this.config.get('POST_ROOM_KEYWORDS_JOB_LEASE_SECONDS', { infer: true }),
    )) {
      const lease = await this.coordinator.acquireRoom(job.roomId);
      if (!lease) continue;
      try {
        const snapshot = await this.candidates.snapshot(job.roomId, lease.fencingToken);
        const expectedVersion = this.config.get('POST_ROOM_KEYWORDS_EXTRACTOR_VERSION', {
          infer: true,
        });
        const selected = snapshot
          .filter(
            (candidate) =>
              candidate.extractorVersion === expectedVersion &&
              this.policy.safeCandidate(candidate.kind, candidate.normalizedText),
          )
          .sort(
            (left, right) =>
              right.count - left.count ||
              left.kind.localeCompare(right.kind) ||
              left.normalizedText.localeCompare(right.normalizedText),
          );
        const keywordLimit = this.config.get('POST_ROOM_KEYWORDS_MAX_KEYWORDS', { infer: true });
        const expressionLimit = this.config.get('POST_ROOM_KEYWORDS_MAX_EXPRESSIONS', {
          infer: true,
        });
        const final = [
          ...selected.filter(({ kind }) => kind === 'KEYWORD').slice(0, keywordLimit),
          ...selected.filter(({ kind }) => kind === 'EXPRESSION').slice(0, expressionLimit),
        ].map(({ kind, displayText, normalizedText }) => ({
          kind,
          displayText,
          normalizedText,
        }));
        if (!final.length) {
          const terminal = now >= job.deadlineAt;
          await this.repository.failJob({
            job,
            terminal,
            errorCategory: 'CANDIDATES_UNAVAILABLE',
            now,
          });
          if (terminal) await this.candidates.delete(job.roomId, lease.fencingToken);
          continue;
        }
        const completed = await this.repository.completeJob({ job, candidates: final, now });
        if (completed) await this.candidates.delete(job.roomId, lease.fencingToken);
      } catch {
        const terminal = now >= job.deadlineAt;
        await this.repository.failJob({
          job,
          terminal,
          errorCategory: 'CANDIDATE_STORE_UNAVAILABLE',
          now,
        });
        this.logger.warn({ event: 'post_room_keyword_job_failed', roomId: job.roomId });
      } finally {
        await this.coordinator.releaseRoom(job.roomId, lease.fencingToken);
      }
    }
  }

  async importItem(
    userId: string,
    input: { clientRequestId: string; sourceSummaryItemId: string },
  ) {
    const payloadHash = createHash('sha256')
      .update(JSON.stringify({ sourceSummaryItemId: input.sourceSummaryItemId }))
      .digest('hex');
    return this.repository.importItem({ userId, ...input, payloadHash });
  }

  async listItems(
    userId: string,
    input: { cursor?: string; limit?: number; favorite?: boolean; kind?: RoomKeywordItemKind },
  ) {
    const favorite = input.favorite ?? null;
    const kind = input.kind ?? null;
    const page = await this.repository.listItems({
      userId,
      limit: input.limit ?? 20,
      favorite,
      kind,
      cursor: input.cursor ? this.decodeCursor(input.cursor, favorite, kind) : null,
    });
    return {
      items: page.items,
      nextCursor: page.nextCursor ? this.encodeCursor(page.nextCursor) : null,
    };
  }

  updateItem(
    userId: string,
    itemId: string,
    input: {
      expectedVersion: number;
      text?: string;
      note?: string | null;
      favorite?: boolean;
    },
  ) {
    if (input.text === undefined && input.note === undefined && input.favorite === undefined)
      throw new AppError('VALIDATION_FAILED', 'At least one editable field is required', 400);
    let text: { displayText: string; normalizedText: string } | undefined;
    try {
      text = input.text === undefined ? undefined : this.policy.normalizePersonal(input.text);
    } catch {
      throw new AppError('VALIDATION_FAILED', 'Vocabulary text is invalid', 400);
    }
    const note = input.note === undefined ? undefined : this.normalizeNote(input.note);
    return this.repository.updateItem({
      userId,
      itemId,
      expectedVersion: input.expectedVersion,
      ...text,
      ...(note === undefined ? {} : { note }),
      ...(input.favorite === undefined ? {} : { favorite: input.favorite }),
    });
  }

  deleteItem(userId: string, itemId: string, expectedVersion: number) {
    return this.repository.deleteItem(userId, itemId, expectedVersion);
  }

  async purge(now = new Date()) {
    const before = new Date(
      now.getTime() -
        this.config.get('POST_ROOM_KEYWORDS_COMMAND_RETENTION_DAYS', { infer: true }) * 86_400_000,
    );
    const [database, redis] = await Promise.all([
      this.repository.purgeTechnical(before),
      this.repository
        .temporaryCandidateRoomIds()
        .then((roomIds) => this.candidates.purgeOrphans(roomIds)),
    ]);
    return { ...database, redis };
  }

  private normalizeNote(note: string | null): string | null {
    if (note === null) return null;
    const normalized = note.normalize('NFKC').replace(/\s+/gu, ' ').trim();
    return normalized || null;
  }

  private encodeCursor(cursor: VocabularyCursor): string {
    return Buffer.from(
      JSON.stringify({
        v: 1,
        updatedAt: cursor.updatedAt.toISOString(),
        id: cursor.id,
        favorite: cursor.favorite,
        kind: cursor.kind,
      }),
    ).toString('base64url');
  }

  private decodeCursor(
    value: string,
    favorite: boolean | null,
    kind: RoomKeywordItemKind | null,
  ): VocabularyCursor {
    try {
      const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as {
        v?: unknown;
        updatedAt?: unknown;
        id?: unknown;
        favorite?: unknown;
        kind?: unknown;
      };
      if (
        parsed.v !== 1 ||
        typeof parsed.updatedAt !== 'string' ||
        typeof parsed.id !== 'string' ||
        !UUID.test(parsed.id) ||
        parsed.favorite !== favorite ||
        parsed.kind !== kind
      )
        throw new Error('shape');
      const updatedAt = new Date(parsed.updatedAt);
      if (Number.isNaN(updatedAt.getTime()) || updatedAt.toISOString() !== parsed.updatedAt)
        throw new Error('date');
      return { updatedAt, id: parsed.id, favorite, kind };
    } catch {
      throw PostRoomLearningError.cursorInvalid();
    }
  }
}
