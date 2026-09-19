import type {
  KeywordSummaryJobLease,
  KeywordSummaryView,
  RoomKeywordItemKind,
  VocabularyItemView,
} from '../entities/post-room-learning.js';

export const POST_ROOM_LEARNING_REPOSITORY = Symbol('POST_ROOM_LEARNING_REPOSITORY');

export interface VocabularyCursor {
  updatedAt: Date;
  id: string;
  favorite: boolean | null;
  kind: RoomKeywordItemKind | null;
}

export interface PostRoomLearningRepository {
  summary(roomId: string, userId: string): Promise<KeywordSummaryView>;
  queueEnded(now: Date, deadlineSeconds: number): Promise<number>;
  claimJobs(now: Date, leaseSeconds: number): Promise<KeywordSummaryJobLease[]>;
  completeJob(input: {
    job: KeywordSummaryJobLease;
    candidates: Array<{ kind: RoomKeywordItemKind; displayText: string; normalizedText: string }>;
    now: Date;
  }): Promise<boolean>;
  failJob(input: {
    job: KeywordSummaryJobLease;
    terminal: boolean;
    errorCategory: string;
    now: Date;
  }): Promise<boolean>;
  importItem(input: {
    userId: string;
    sourceSummaryItemId: string;
    clientRequestId: string;
    payloadHash: string;
  }): Promise<VocabularyItemView>;
  listItems(input: {
    userId: string;
    limit: number;
    cursor: VocabularyCursor | null;
    favorite: boolean | null;
    kind: RoomKeywordItemKind | null;
  }): Promise<{ items: VocabularyItemView[]; nextCursor: VocabularyCursor | null }>;
  updateItem(input: {
    userId: string;
    itemId: string;
    expectedVersion: number;
    displayText?: string;
    normalizedText?: string;
    note?: string | null;
    favorite?: boolean;
  }): Promise<VocabularyItemView>;
  deleteItem(userId: string, itemId: string, expectedVersion: number): Promise<void>;
  temporaryCandidateRoomIds(): Promise<Set<string>>;
  purgeTechnical(before: Date): Promise<{ jobs: number; commands: number }>;
}
