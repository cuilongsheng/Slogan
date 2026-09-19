import type { AnonymousKeywordCandidate } from '../entities/post-room-learning.js';

export const KEYWORD_CANDIDATE_STORE = Symbol('KEYWORD_CANDIDATE_STORE');

export interface KeywordCandidateStore {
  append(input: {
    roomId: string;
    fencingToken: string;
    candidates: AnonymousKeywordCandidate[];
    ttlSeconds: number;
    maxKeywords: number;
    maxExpressions: number;
  }): Promise<void>;
  snapshot(roomId: string, fencingToken: string): Promise<AnonymousKeywordCandidate[]>;
  delete(roomId: string, fencingToken: string): Promise<void>;
  purgeOrphans(validRoomIds: Set<string>): Promise<number>;
}
