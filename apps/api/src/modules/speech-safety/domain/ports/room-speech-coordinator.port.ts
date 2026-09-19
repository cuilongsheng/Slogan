export const ROOM_SPEECH_COORDINATOR = Symbol('ROOM_SPEECH_COORDINATOR');

export interface RoomSpeechCoordinator {
  healthCheck(): Promise<void>;
  acquireRoom(roomId: string): Promise<{ fencingToken: string } | null>;
  renewRoom(roomId: string, fencingToken: string): Promise<boolean>;
  releaseRoom(roomId: string, fencingToken: string): Promise<void>;
  allowRisk(key: string, ttlSeconds: number, limit: number): Promise<boolean>;
}
