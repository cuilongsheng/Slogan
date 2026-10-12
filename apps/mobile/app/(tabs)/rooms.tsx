import { Gate } from '../../src/features/auth';
import { RoomListScreen } from '../../src/features/room-discovery/RoomListScreen';

export default function RoomsRoute() {
  return (
    <Gate allow="ELIGIBLE">
      <RoomListScreen />
    </Gate>
  );
}
