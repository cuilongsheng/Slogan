import { useLocalSearchParams } from 'expo-router';

import { Gate } from '../../../src/features/auth';
import { JoinPasswordScreen } from '../../../src/features/room-discovery/JoinScreens';

export default function PasswordRoute() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  return (
    <Gate allow="ELIGIBLE">
      <JoinPasswordScreen roomId={roomId} />
    </Gate>
  );
}
