import { Gate } from '../../src/features/auth';
import { MessagesScreen } from '../../src/features/direct/MessagesScreen';
export default function MessagesRoute() {
  return (
    <Gate allow="ELIGIBLE">
      <MessagesScreen />
    </Gate>
  );
}
