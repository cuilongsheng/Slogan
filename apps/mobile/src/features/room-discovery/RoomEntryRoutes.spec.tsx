import { render } from '@testing-library/react-native';
import RoomRoute from '../../../app/rooms/[roomId]/index';
import RulesRoute from '../../../app/rooms/[roomId]/rules';
import DeviceRoute from '../../../app/rooms/[roomId]/device';
import PasswordRoute from '../../../app/rooms/[roomId]/password';

const mockRedirect = jest.fn((_props: unknown) => null);
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ roomId: 'room-a', invitationId: 'invite-a' }),
  Redirect: (props: unknown) => mockRedirect(props),
}));
jest.mock('../auth', () => ({ Gate: ({ children }: { children: React.ReactNode }) => children }));

test.each([RoomRoute, RulesRoute, DeviceRoute, PasswordRoute])(
  'legacy entry URLs forward to the session and preserve their invitation',
  async (Route) => {
    mockRedirect.mockClear();
    await render(<Route />);
    expect(mockRedirect).toHaveBeenCalledWith({
      href: {
        pathname: '/rooms/[roomId]/session',
        params: { roomId: 'room-a', invitationId: 'invite-a' },
      },
    });
  },
);
