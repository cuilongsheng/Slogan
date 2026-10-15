export type LiveScope = 'rooms' | 'partners' | 'messages';
export type StreamPositions = [string, string];
export type StreamChange = { index: number; id: string; scope: LiveScope };
export interface LiveReader {
  read(positions: StreamPositions): Promise<StreamChange[]>;
  close(): void;
}
export interface LiveUpdatesStore {
  dispatch(): Promise<void>;
  expirePresence(owner: string, generation?: string): Promise<number>;
  bounds(owner: string): Promise<{ first: StreamPositions; last: StreamPositions }>;
  reader(owner: string, signal: AbortSignal): Promise<LiveReader>;
}
export const LIVE_UPDATES_STORE = Symbol('LIVE_UPDATES_STORE');
