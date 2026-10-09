import { useLocalSearchParams } from 'expo-router';

import { Gate } from '../../../src/features/auth';
import { VoiceRoomScreen } from '../../../src/features/voice-room/VoiceRoomScreen';

export default function VoiceRoomRoute() {
  const { roomId, invitationId } = useLocalSearchParams<{
    roomId: string;
    invitationId?: string;
  }>();
  return (
    <Gate allow="ELIGIBLE">
      <VoiceRoomScreen
        key={`${roomId}:${invitationId ?? ''}`}
        roomId={roomId}
        {...(invitationId ? { invitationId } : {})}
      />
    </Gate>
  );
}
