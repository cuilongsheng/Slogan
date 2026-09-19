import { roomSpeechWorkerGrant } from '../../src/workers/room-speech/livekit-room-media-source.js';

describe('room speech LiveKit service participant policy', () => {
  it('is hidden, subscribe-only and has no room management or recording grants', () => {
    expect(roomSpeechWorkerGrant('00000000-0000-4000-8000-000000000001')).toEqual({
      room: 'room-00000000-0000-4000-8000-000000000001',
      roomJoin: true,
      canSubscribe: true,
      canPublish: false,
      canPublishData: false,
      canUpdateOwnMetadata: false,
      hidden: true,
      roomAdmin: false,
      roomCreate: false,
      roomRecord: false,
      roomList: false,
    });
  });
});
