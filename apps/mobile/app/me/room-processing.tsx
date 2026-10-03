import { Gate } from '../../src/features/auth';
import { RoomPrivacyScreen } from '../../src/features/room-processing-consents/RoomPrivacyScreen';

export default function RoomProcessingRoute() {
  return <Gate allow="ELIGIBLE"><RoomPrivacyScreen /></Gate>;
}
