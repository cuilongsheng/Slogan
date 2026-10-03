import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { RoomControls } from './RoomControls';

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '6f7892e8-5f39-4d4e-a5d8-1d21c532a010'),
}));

const members = [
  {
    membershipId: 'own',
    userId: 'host-user',
    displayName: 'Host',
    cefrLevel: 'B1_B2',
    credentialVersion: 0,
    role: 'HOST',
  },
  {
    membershipId: 'other',
    userId: 'other-user',
    displayName: 'Guest',
    cefrLevel: 'A1_A2',
    credentialVersion: 3,
    role: 'MEMBER',
  },
] as never;

describe('room controls', () => {
  it('confirms before removing another member and refreshes after success', async () => {
    const api = {
      removeMember: jest.fn(async () => ({ lifecycle: 'REMOVED' })),
      removedMembers: jest.fn(async () => []),
    };
    const refresh = jest.fn(async () => undefined);
    const page = await render(
      <RoomControls
        roomId="room-1"
        members={members}
        ownMembershipId="own"
        isHost
        api={api as never}
        refresh={refresh}
        onClose={jest.fn()}
      />,
    );
    await fireEvent.press(page.getByRole('button', { name: 'Remove' }));
    expect(api.removeMember).not.toHaveBeenCalled();
    await fireEvent.press(page.getByRole('button', { name: 'Confirm removal' }));
    await waitFor(() =>
      expect(api.removeMember).toHaveBeenCalledWith(
        'room-1',
        expect.objectContaining({ membershipId: 'other', credentialVersion: 3 }),
      ),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('keeps the report request ID and content stable after a failed submit', async () => {
    const report = jest
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ id: 'report-1', caseId: 'case-1' });
    const page = await render(
      <RoomControls
        roomId="room-1"
        members={members}
        ownMembershipId="own"
        isHost={false}
        api={{ report } as never}
        refresh={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    await fireEvent.press(page.getByRole('button', { name: 'Report a member' }));
    await fireEvent.press(page.getByRole('button', { name: 'Harassment or abuse' }));
    await fireEvent.changeText(page.getByLabelText('Details'), 'Behavior details');
    await fireEvent.press(page.getByRole('button', { name: 'Submit report' }));
    await waitFor(() => expect(report).toHaveBeenCalledTimes(1));
    await fireEvent.press(page.getByRole('button', { name: 'Submit report' }));
    await waitFor(() => expect(report).toHaveBeenCalledTimes(2));
    expect(report.mock.calls[1]).toEqual(report.mock.calls[0]);
    await waitFor(() => expect(page.getByText('Report received')).toBeTruthy());
  });

  it('offers an offline friend as a room invitation candidate', async () => {
    const inviteUser = jest.fn(async () => ({ id: 'invite-1' }));
    const api = {
      availablePeople: jest.fn(async () => ({ items: [], nextCursor: null })),
      friends: jest.fn(async () => ({
        items: [
          {
            friend: { userId: 'friend-1', displayName: 'Friend', cefrLevel: 'B1' },
            isAvailable: false,
          },
        ],
        nextCursor: null,
      })),
      inviteUser,
    };
    const page = await render(
      <RoomControls
        roomId="room-1"
        members={members}
        ownMembershipId="own"
        isHost
        api={api as never}
        refresh={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    await fireEvent.press(page.getByRole('button', { name: 'Invite to room' }));
    await waitFor(() => expect(page.getByText('Friend')).toBeTruthy());
    await fireEvent.press(page.getByRole('button', { name: 'Invite' }));
    await waitFor(() =>
      expect(inviteUser).toHaveBeenCalledWith('room-1', 'friend-1', expect.any(String)),
    );
  });
});
