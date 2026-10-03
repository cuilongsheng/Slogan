import { Gate } from '../../src/features/auth';
import { CreateRoomScreen } from '../../src/features/room-creation/CreateRoomScreen';

export default function CreateRoomRoute() {
  return (
    <Gate allow="ELIGIBLE">
      <CreateRoomScreen />
    </Gate>
  );
}
