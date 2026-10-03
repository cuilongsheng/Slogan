import { Gate } from '../../../src/features/auth';
import { HistoryScreen } from '../../../src/features/history/HistoryScreen';

export default function HistoryRoute() {
  return <Gate allow="ELIGIBLE"><HistoryScreen /></Gate>;
}
