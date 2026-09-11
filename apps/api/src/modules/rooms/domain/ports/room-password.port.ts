export const ROOM_PASSWORD_HASHER = Symbol('ROOM_PASSWORD_HASHER');

export interface RoomPasswordHasher {
  digest(roomId: string, password: string): string;
  matches(roomId: string, password: string, expectedDigest: string): boolean;
}
