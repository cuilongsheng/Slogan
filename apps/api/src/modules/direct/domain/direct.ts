export type DirectCallStatus = 'RINGING' | 'ACTIVE' | 'REJECTED' | 'EXPIRED' | 'ENDED';
export interface DirectPeer {
  userId: string;
  displayName: string;
  avatarUrl: string;
  cefrLevel: string;
}
export interface DirectMessageRecord {
  id: string;
  conversationId: string;
  senderUserId: string;
  clientRequestId: string;
  sequence: number;
  text: string;
  createdAt: Date;
}
export interface DirectConversationRecord {
  id: string;
  peer: DirectPeer;
  lastMessage: DirectMessageRecord | null;
  lastCall: DirectCallRecord | null;
  unreadCount: number;
  lastActivityAt: Date;
  canInteract: boolean;
}
export interface DirectCallRecord {
  id: string;
  conversationId: string;
  sequence: number;
  callerUserId: string;
  calleeUserId: string;
  status: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  endedAt: Date | null;
  endReason: string | null;
  peer?: DirectPeer;
}
export interface DirectPage<T> {
  items: T[];
  nextCursor: string | null;
  visibleAfterSequence?: number;
}
export interface DirectPageQuery {
  cursor?: string;
  limit?: number;
}
export interface DirectTimelineQuery {
  before?: string;
  after?: string;
  limit?: number;
}
export type DirectTimelineEntry =
  | { kind: 'text'; revision: number; value: DirectMessageRecord }
  | { kind: 'call'; revision: number; value: DirectCallRecord };
export interface DirectTimelinePage {
  items: DirectTimelineEntry[];
  visibleAfterSequence: number;
  nextBeforeCursor: string | null;
  hasOlder: boolean;
  syncCursor: string;
  nextAfterCursor: string | null;
  hasMoreChanges: boolean;
}
export const DIRECT_REPOSITORY = Symbol('DIRECT_REPOSITORY');
export interface DirectRepository {
  timeline(actor: string, id: string, query: DirectTimelineQuery): Promise<DirectTimelinePage>;
  unreadCount(actor: string): Promise<number>;
  open(actor: string, target: string): Promise<DirectConversationRecord>;
  conversations(
    actor: string,
    query: DirectPageQuery,
  ): Promise<DirectPage<DirectConversationRecord>>;
  detail(actor: string, id: string): Promise<DirectConversationRecord>;
  messages(
    actor: string,
    id: string,
    query: DirectPageQuery,
  ): Promise<DirectPage<DirectMessageRecord>>;
  send(actor: string, id: string, text: string, requestId: string): Promise<DirectMessageRecord>;
  read(actor: string, id: string, sequence: number): Promise<void>;
  hide(actor: string, id: string, requestId: string): Promise<void>;
  report(
    actor: string,
    id: string,
    messageId: string,
    category: string,
    description: string,
    requestId: string,
  ): Promise<{ id: string; caseId: string; submittedAt: Date }>;
  callHistory(
    actor: string,
    id: string,
    query: DirectPageQuery,
  ): Promise<DirectPage<DirectCallRecord>>;
  requestCall(actor: string, id: string, requestId: string): Promise<DirectCallRecord>;
  call(actor: string, id: string): Promise<DirectCallRecord>;
  calls(actor: string): Promise<DirectCallRecord[]>;
  actCall(
    actor: string,
    id: string,
    action: 'accept' | 'reject' | 'end',
    requestId: string,
  ): Promise<DirectCallRecord>;
  heartbeat(actor: string, id: string): Promise<DirectCallRecord>;
  reserveCredentials(actor: string, id: string, expiresAt: Date): Promise<boolean>;
  rescheduleCleanup(id: string): Promise<void>;
  expireAndClaimCleanup(): Promise<
    Array<{
      id: string;
      leaseId: string;
      generation: number;
      callerUserId: string;
      calleeUserId: string;
      credentialExpiresAt: Date | null;
    }>
  >;
  finishCleanup(id: string, leaseId: string, generation: number, success: boolean): Promise<void>;
}
