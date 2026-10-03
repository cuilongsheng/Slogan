import { useLocalSearchParams } from 'expo-router';

import { Gate } from '../../../src/features/auth';
import { VoiceRoomScreen } from '../../../src/features/voice-room/VoiceRoomScreen';

export default function VoiceRoomRoute() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  return (
    <Gate allow="ELIGIBLE">
      <VoiceRoomScreen roomId={roomId} />
    </Gate>
  );
}
