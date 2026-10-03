import { useLocalSearchParams } from 'expo-router';

import { Gate } from '../../../src/features/auth';
import { RoomDetailScreen } from '../../../src/features/room-discovery/RoomDetailScreen';

export default function RoomDetailRoute() {
  const { roomId, invitationId } = useLocalSearchParams<{ roomId: string; invitationId?: string }>();
  return (
    <Gate allow="ELIGIBLE">
      <RoomDetailScreen roomId={roomId} {...(invitationId ? { invitationId } : {})} />
    </Gate>
  );
}
