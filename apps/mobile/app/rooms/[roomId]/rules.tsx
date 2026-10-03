import { useLocalSearchParams } from 'expo-router';

import { Gate } from '../../../src/features/auth';
import { JoinRulesScreen } from '../../../src/features/room-discovery/JoinScreens';

export default function RulesRoute() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  return (
    <Gate allow="ELIGIBLE">
      <JoinRulesScreen roomId={roomId} />
    </Gate>
  );
}
