import { useLocalSearchParams } from 'expo-router';
import { Gate } from '../../src/features/auth';
import { CallScreen } from '../../src/features/direct/CallScreen';
export default function CallRoute() {
  const { callId } = useLocalSearchParams<{ callId: string }>();
  return (
    <Gate allow="ELIGIBLE">
      <CallScreen key={callId} callId={callId} />
    </Gate>
  );
}
