import { render, screen } from '@testing-library/react-native';
import { Redirect } from 'expo-router';
import { Text } from 'react-native';

import { Gate } from './Gate';
import { useAuth } from './context';

jest.mock('./context', () => ({ useAuth: jest.fn() }));
jest.mock('expo-router', () => ({ Redirect: jest.fn(() => null) }));

describe('eligible room route gate', () => {
  it('redirects signed-out, incomplete and underage accounts', async () => {
    const auth = useAuth as jest.Mock;
    auth.mockReturnValue({ state: { kind: 'signedOut' } });
    const out = await render(
      <Gate allow="ELIGIBLE">
        <Text>Room</Text>
      </Gate>,
    );
    expect((Redirect as jest.Mock).mock.lastCall?.[0]).toMatchObject({ href: '/sign-in' });
    await out.unmount();

    auth.mockReturnValue({
      state: { kind: 'signedIn', me: { onboardingState: 'PROFILE_REQUIRED' } },
    });
    const incomplete = await render(
      <Gate allow="ELIGIBLE">
        <Text>Room</Text>
      </Gate>,
    );
    expect((Redirect as jest.Mock).mock.lastCall?.[0]).toMatchObject({ href: '/profile/basic' });
    await incomplete.unmount();

    auth.mockReturnValue({
      state: { kind: 'signedIn', me: { onboardingState: 'AGE_RESTRICTED' } },
    });
    await render(
      <Gate allow="ELIGIBLE">
        <Text>Room</Text>
      </Gate>,
    );
    expect((Redirect as jest.Mock).mock.lastCall?.[0]).toMatchObject({ href: '/age-restricted' });
  });

  it('renders the room only for an eligible account', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      state: { kind: 'signedIn', me: { onboardingState: 'ELIGIBLE' } },
    });
    await render(
      <Gate allow="ELIGIBLE">
        <Text>Room</Text>
      </Gate>,
    );
    expect(screen.getByText('Room')).toBeTruthy();
  });
});
