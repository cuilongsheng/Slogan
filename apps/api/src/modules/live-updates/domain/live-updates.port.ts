export const LIVE_SCOPES = [
  'rooms',
  'partners',
  'messages',
  'conversation-history',
  'conversation-state',
  'inbox',
  'unread',
  'calls',
  'invitations',
  'room-state',
  'room-text',
  'room-safety',
  'account',
  'safety',
  'reports',
  'learning',
  'release',
] as const;
export type LiveScope = (typeof LIVE_SCOPES)[number];
export type StreamPositions = [string, string];
export type StreamChange = {
  index: number;
  id: string;
  scope: LiveScope;
  resourceId?: string;
  kind?: 'membership' | 'visibility';
};
export interface LiveReader {
  read(positions: StreamPositions): Promise<StreamChange[]>;
  close(): void;
}
export interface LiveUpdatesStore {
  dispatch(): Promise<void>;
  reconcileRelease(): Promise<void>;
  canReceive(owner: string, change: StreamChange): Promise<boolean>;
  expirePresence(owner: string, generation?: string): Promise<number>;
  bounds(owner: string): Promise<{ first: StreamPositions; last: StreamPositions }>;
  reader(owner: string, signal: AbortSignal): Promise<LiveReader>;
}
export const LIVE_UPDATES_STORE = Symbol('LIVE_UPDATES_STORE');
