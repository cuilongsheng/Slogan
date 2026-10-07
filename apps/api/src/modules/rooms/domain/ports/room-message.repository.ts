export interface RoomTextMessage {
  id: string;
  sequence: string;
  senderUserId: string;
  senderDisplayName: string;
  text: string;
  createdAt: Date;
}
export const ROOM_MESSAGE_REPOSITORY = Symbol('ROOM_MESSAGE_REPOSITORY');
export interface RoomMessageRepository {
  send(input: {
    roomId: string;
    userId: string;
    clientRequestId: string;
    text: string;
  }): Promise<RoomTextMessage>;
  list(input: {
    roomId: string;
    userId: string;
    after: string | null;
    limit: number;
  }): Promise<{ items: RoomTextMessage[]; hasMore: boolean }>;
}
