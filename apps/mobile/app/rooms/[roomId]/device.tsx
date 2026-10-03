import { useLocalSearchParams } from 'expo-router';

import { Gate } from '../../../src/features/auth';
import { JoinDeviceScreen } from '../../../src/features/room-discovery/JoinScreens';

export default function DeviceRoute() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  return (
    <Gate allow="ELIGIBLE">
      <JoinDeviceScreen roomId={roomId} />
    </Gate>
  );
}
