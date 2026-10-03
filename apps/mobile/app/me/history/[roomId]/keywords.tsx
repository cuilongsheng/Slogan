import { useLocalSearchParams } from 'expo-router';

import { Gate } from '../../../../src/features/auth';
import { SummaryScreen } from '../../../../src/features/learning/SummaryScreen';

export default function KeywordsRoute() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  return <Gate allow="ELIGIBLE"><SummaryScreen roomId={roomId} /></Gate>;
}
