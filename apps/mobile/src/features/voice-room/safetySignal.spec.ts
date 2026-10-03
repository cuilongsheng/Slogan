import { isRoomSafetyAlertSignal, SAFETY_ALERT_TOPIC } from './safetySignal';

const packet = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

describe('room safety data packet', () => {
  const message = {
    version: 1,
    type: 'ROOM_SAFETY_ALERT',
    alert: { id: 'alert-1', roomId: 'room-1' },
  };

  it('accepts only the current room and known envelope on the targeted topic', () => {
    expect(isRoomSafetyAlertSignal(packet(message), SAFETY_ALERT_TOPIC, 'room-1')).toBe(true);
    expect(isRoomSafetyAlertSignal(packet(message), 'other-topic', 'room-1')).toBe(false);
    expect(isRoomSafetyAlertSignal(packet(message), SAFETY_ALERT_TOPIC, 'room-2')).toBe(false);
    expect(
      isRoomSafetyAlertSignal(packet({ ...message, version: 2 }), SAFETY_ALERT_TOPIC, 'room-1'),
    ).toBe(false);
    expect(
      isRoomSafetyAlertSignal(
        packet({ ...message, type: 'UNKNOWN' }),
        SAFETY_ALERT_TOPIC,
        'room-1',
      ),
    ).toBe(false);
    expect(isRoomSafetyAlertSignal(new Uint8Array([255]), SAFETY_ALERT_TOPIC, 'room-1')).toBe(
      false,
    );
  });
});
