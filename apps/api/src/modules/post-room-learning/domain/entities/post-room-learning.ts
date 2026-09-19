export const ROOM_KEYWORD_ITEM_KINDS = ['KEYWORD', 'EXPRESSION'] as const;
export type RoomKeywordItemKind = (typeof ROOM_KEYWORD_ITEM_KINDS)[number];

export interface AnonymousKeywordCandidate {
  kind: RoomKeywordItemKind;
  normalizedText: string;
  displayText: string;
  count: number;
  extractorVersion: string;
}

export interface KeywordSummaryItem {
  id: string;
  kind: RoomKeywordItemKind;
  text: string;
  rank: number;
}

export interface KeywordSummaryView {
  roomId: string;
  topic: string;
  status: 'DISABLED' | 'PENDING' | 'READY' | 'UNAVAILABLE';
  generatedAt: Date | null;
  items: KeywordSummaryItem[];
}

export interface VocabularyItemView {
  id: string;
  kind: RoomKeywordItemKind;
  text: string;
  note: string | null;
  favorite: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface KeywordSummaryJobLease {
  id: string;
  summaryId: string;
  roomId: string;
  leaseId: string;
  deadlineAt: Date;
}
