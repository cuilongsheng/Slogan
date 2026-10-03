import { useLocalSearchParams } from 'expo-router';
import { Gate } from '../../../src/features/auth';
import { AppointmentDetailScreen } from '../../../src/features/room-creation/AppointmentDetailScreen';

export default function AppointmentDetailRoute() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  return (
    <Gate allow="ELIGIBLE">
      <AppointmentDetailScreen roomId={roomId} />
    </Gate>
  );
}
