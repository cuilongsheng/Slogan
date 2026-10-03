export const SAFETY_ALERT_TOPIC = 'slogan.room-safety-alert.v1';

export function isRoomSafetyAlertSignal(
  payload: Uint8Array,
  topic: string | undefined,
  roomId: string,
): boolean {
  if (topic !== SAFETY_ALERT_TOPIC || payload.byteLength > 4096) return false;
  try {
    const message: unknown = JSON.parse(new TextDecoder().decode(payload));
    if (typeof message !== 'object' || message === null) return false;
    if (!('version' in message) || message.version !== 1) return false;
    if (!('type' in message) || message.type !== 'ROOM_SAFETY_ALERT') return false;
    if (!('alert' in message) || typeof message.alert !== 'object' || message.alert === null)
      return false;
    return 'roomId' in message.alert && message.alert.roomId === roomId;
  } catch {
    return false;
  }
}
