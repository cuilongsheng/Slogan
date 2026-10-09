import { Redirect, useLocalSearchParams } from 'expo-router';

import { Gate } from '../../../src/features/auth';

export default function RoomEntryRoute() {
  const { roomId, invitationId } = useLocalSearchParams<{
    roomId: string;
    invitationId?: string;
  }>();
  return (
    <Gate allow="ELIGIBLE">
      <Redirect
        href={{
          pathname: '/rooms/[roomId]/session',
          params: { roomId, ...(invitationId ? { invitationId } : {}) },
        }}
      />
    </Gate>
  );
}
