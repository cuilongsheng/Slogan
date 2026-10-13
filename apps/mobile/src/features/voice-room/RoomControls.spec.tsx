import type * as ReactTypes from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { RoomControls } from './RoomControls';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: (effect: () => void | (() => void)) => {
    const React = jest.requireActual('react') as typeof ReactTypes;
    React.useEffect(effect, [effect]);
  },
}));

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

  it('opens the invitation list directly and only offers online idle candidates', async () => {
    const inviteUser = jest.fn(async () => ({ id: 'invite-1' }));
    const api = {
      sentInvitations: jest.fn(async () => ({ items: [], nextCursor: null })),
      availablePeople: jest.fn(async () => ({
        items: [
          { userId: 'person-1', displayName: 'Online idle', cefrLevel: 'B1', isAvailable: true },
          {
            userId: 'other-user',
            displayName: 'Already in room',
            cefrLevel: 'B1',
            isAvailable: true,
          },
          { userId: 'offline', displayName: 'Offline', cefrLevel: 'B1', isAvailable: false },
        ],
        nextCursor: null,
      })),
      friends: jest.fn(),
      inviteUser,
    };
    const page = await render(
      <RoomControls
        roomId="room-1"
        members={members}
        ownMembershipId="own"
        isHost
        initialMode="invite"
        api={api as never}
        refresh={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    await waitFor(() => expect(page.getByText('Online idle')).toBeTruthy());
    expect(page.queryByText('Already in room')).toBeNull();
    expect(page.queryByText('Offline')).toBeNull();
    expect(api.friends).not.toHaveBeenCalled();
    await fireEvent.changeText(page.getByLabelText('Search available people'), 'No match');
    expect(page.queryByText('Online idle')).toBeNull();
    await fireEvent.changeText(page.getByLabelText('Search available people'), 'Online');
    expect(page.getByText('Online idle')).toBeTruthy();
    await fireEvent.press(page.getByRole('button', { name: 'Invite Online idle' }));
    await waitFor(() =>
      expect(inviteUser).toHaveBeenCalledWith('room-1', 'person-1', expect.any(String)),
    );
    expect(page.getByText('Invitation sent')).toBeTruthy();
  });

  it('cannot open invitations as an ordinary member', async () => {
    const api = { availablePeople: jest.fn() };
    const page = await render(
      <RoomControls
        roomId="room-1"
        members={members}
        ownMembershipId="other"
        isHost={false}
        initialMode="invite"
        api={api as never}
        refresh={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(api.availablePeople).not.toHaveBeenCalled();
    expect(page.queryByText('Invite to room')).toBeNull();
  });
});

test('a room report opens directly and sends no accused user identifier', async () => {
  const report = jest.fn(async () => ({ id: 'report-room', caseId: 'case-room' }));
  const page = await render(
    <RoomControls
      roomId="room-1"
      members={members}
      ownMembershipId="own"
      isHost
      initialMode="reportRoom"
      roomTopic="Travel room"
      api={{ report } as never}
      refresh={jest.fn()}
      onClose={jest.fn()}
    />,
  );
  expect(page.getByText('Report room')).toBeTruthy();
  expect(page.getByText('Travel room')).toBeTruthy();
  await fireEvent.press(page.getByRole('button', { name: 'Harassment or abuse' }));
  await fireEvent.changeText(page.getByLabelText('Details'), 'Room behavior');
  await fireEvent.press(page.getByRole('button', { name: 'Submit report' }));
  await waitFor(() => expect(report).toHaveBeenCalledTimes(1));
  expect(report).toHaveBeenCalledWith(
    'room-1',
    expect.objectContaining({ description: 'Room behavior', category: 'HARASSMENT_ABUSE' }),
  );
  expect((report.mock.calls[0] as unknown as [string, object])[1]).not.toHaveProperty(
    'targetUserId',
  );
});

test('an open invitation picker updates when a peer becomes idle and stops polling on close', async () => {
  jest.useFakeTimers();
  const availablePeople = jest
    .fn()
    .mockResolvedValueOnce({ items: [], nextCursor: null })
    .mockResolvedValue({
      items: [
        { userId: 'new-idle', displayName: 'New idle peer', cefrLevel: 'B1', isAvailable: true },
      ],
      nextCursor: null,
    });
  const page = await render(
    <RoomControls
      roomId="room-1"
      members={members}
      ownMembershipId="own"
      isHost
      initialMode="invite"
      api={
        {
          availablePeople,
          sentInvitations: jest.fn(async () => ({ items: [], nextCursor: null })),
        } as never
      }
      refresh={jest.fn()}
      onClose={jest.fn()}
    />,
  );
  try {
    await waitFor(() => expect(availablePeople).toHaveBeenCalledTimes(1));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5000);
    });
    expect(page.getByText('New idle peer')).toBeTruthy();
    await page.unmount();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_000);
    });
    expect(availablePeople).toHaveBeenCalledTimes(2);
  } finally {
    jest.useRealTimers();
  }
});

test('restores sent state from the server after reopening and blocks repeat invitations', async () => {
  const api = {
    sentInvitations: jest.fn(async () => ({
      items: [{ inviteeUserId: 'person-1' }],
      nextCursor: null,
    })),
    availablePeople: jest.fn(async () => ({
      items: [
        { userId: 'person-1', displayName: 'Invited peer', cefrLevel: 'B1', isAvailable: true },
      ],
      nextCursor: null,
    })),
    inviteUser: jest.fn(),
  };
  const page = await render(
    <RoomControls
      roomId="room-1"
      members={members}
      ownMembershipId="own"
      isHost
      initialMode="invite"
      api={api as never}
      refresh={jest.fn()}
      onClose={jest.fn()}
    />,
  );
  await waitFor(() => expect(page.getByText('Invitation sent')).toBeTruthy());
  await fireEvent.press(
    page.getByRole('button', { name: 'Invitation sent Invited peer', disabled: true }),
  );
  expect(api.inviteUser).not.toHaveBeenCalled();
});

test('a pending read begun before a send completes cannot erase the successful sent state', async () => {
  jest.useFakeTimers();
  let resolvePending!: (value: { items: never[]; nextCursor: null }) => void;
  const sentInvitations = jest
    .fn()
    .mockResolvedValueOnce({ items: [], nextCursor: null })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePending = resolve;
        }),
    )
    .mockResolvedValue({ items: [], nextCursor: null });
  const api = {
    sentInvitations,
    availablePeople: jest.fn(async () => ({
      items: [
        { userId: 'race-peer', displayName: 'Race peer', cefrLevel: 'B1', isAvailable: true },
      ],
      nextCursor: null,
    })),
    inviteUser: jest.fn(async () => ({ id: 'sent' })),
  };
  const page = await render(
    <RoomControls
      roomId="room-1"
      members={members}
      ownMembershipId="own"
      isHost
      initialMode="invite"
      api={api as never}
      refresh={jest.fn()}
      onClose={jest.fn()}
    />,
  );
  try {
    await waitFor(() => expect(page.getByText('Race peer')).toBeTruthy());
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5000);
    });
    expect(sentInvitations).toHaveBeenCalledTimes(2);
    await fireEvent.press(page.getByRole('button', { name: 'Invite Race peer' }));
    await waitFor(() => expect(page.getByText('Invitation sent')).toBeTruthy());
    await act(async () => resolvePending({ items: [], nextCursor: null }));
    expect(page.getByText('Invitation sent')).toBeTruthy();
    await fireEvent.press(
      page.getByRole('button', { name: 'Invitation sent Race peer', disabled: true }),
    );
    expect(api.inviteUser).toHaveBeenCalledTimes(1);
  } finally {
    await page.unmount();
    jest.useRealTimers();
  }
});
