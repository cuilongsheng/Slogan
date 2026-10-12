import { RoomApiError } from '../room-discovery/api';
import type { VoiceRoomApi } from './api';
export interface RoomExitIntent {
  roomId: string;
  action: 'leave' | 'end';
  expectedCredentialVersion: number;
  successorMembershipId?: string;
}
type Storage = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
};
type Api = Pick<VoiceRoomApi, 'leave' | 'end'>;
export class RoomExitQueue {
  private readonly key: string;
  private items = new Map<string, RoomExitIntent>();
  private saving = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private retryDelay = 2000;
  private running = false;
  private delivery: Promise<void> | null = null;
  private stopped = false;
  private restored = false;
  constructor(
    userId: string,
    private readonly api: Api,
    private readonly storage: Storage,
    private readonly changed: (failed: boolean) => void,
  ) {
    this.key = `slogan.roomExits.${userId}`;
  }
  private id(item: RoomExitIntent) {
    return `${item.action}:${item.roomId}:${item.expectedCredentialVersion}`;
  }
  private async restore() {
    if (this.restored) return;
    const raw = await this.storage.get(this.key);
    const records: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(records))
      for (const value of records) {
        if (
          typeof value !== 'object' ||
          !value ||
          typeof value.roomId !== 'string' ||
          !['leave', 'end'].includes(value.action) ||
          !Number.isInteger(value.expectedCredentialVersion) ||
          value.expectedCredentialVersion < 0 ||
          (value.successorMembershipId !== undefined &&
            typeof value.successorMembershipId !== 'string')
        )
          continue;
        const item = value as RoomExitIntent;
        if (!this.items.has(this.id(item))) this.items.set(this.id(item), item);
      }
    this.restored = true;
    if (this.items.size) this.changed(false);
  }
  enqueue(intent: RoomExitIntent): void {
    if (this.stopped) return;
    this.items.set(this.id(intent), intent);
    this.changed(false);
    if (this.running && this.restored) void this.save().catch(() => this.changed(true));
    void this.flush();
  }
  get pendingRoomIds(): string[] {
    return [...new Set([...this.items.values()].map((item) => item.roomId))];
  }
  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }
  private save() {
    const contents = JSON.stringify([...this.items.values()]);
    this.saving = this.saving
      .catch(() => undefined)
      .then(() => this.storage.set(this.key, contents));
    return this.saving;
  }
  flush(): Promise<void> {
    if (this.delivery) return this.delivery;
    const delivery = this.deliver().finally(() => {
      if (this.delivery === delivery) this.delivery = null;
    });
    this.delivery = delivery;
    return delivery;
  }
  private async deliver(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    if (this.timer) clearTimeout(this.timer);
    try {
      await this.restore();
      if (this.stopped) return;
      await this.save();
      for (const [key, intent] of [...this.items]) {
        if (this.stopped) return;
        await this.save();
        if (this.stopped) return;
        try {
          if (intent.action === 'end') {
            const response = await this.api.end(intent.roomId);
            if (!['ENDING', 'ENDED'].includes(response.roomStatus))
              throw new RoomApiError(409, 'ROOM_END_UNCONFIRMED');
          } else {
            const response = await this.api.leave(
              intent.roomId,
              intent.expectedCredentialVersion,
              intent.successorMembershipId,
            );
            if (
              !['LEFT', 'REMOVED'].includes(response.lifecycle) &&
              response.roomStatus !== 'ENDED'
            )
              throw new RoomApiError(409, 'ROOM_LEAVE_UNCONFIRMED');
          }
          this.items.delete(key);
          await this.save();
          this.retryDelay = 2000;
          this.changed(false);
        } catch (error) {
          const code = error instanceof RoomApiError ? error.code : 'NETWORK_ERROR';
          if (
            [
              'ROOM_ENDED',
              'ROOM_CANCELLED',
              'ROOM_NOT_FOUND',
              'ROOM_MEMBER_NOT_ACTIVE',
              'ROOM_MEMBERSHIP_REQUIRED',
            ].includes(code)
          ) {
            this.items.delete(key);
            await this.save();
            this.changed(false);
          } else {
            if (code === 'ROOM_SUCCESSOR_INVALID') {
              delete intent.successorMembershipId;
              await this.save();
            }
            this.changed(true);
          }
        }
      }
    } catch {
      this.changed(true);
    } finally {
      this.running = false;
      if (!this.stopped && this.items.size) {
        this.timer = setTimeout(() => void this.flush(), this.retryDelay);
        this.retryDelay = Math.min(30_000, this.retryDelay * 2);
      }
    }
  }
}
