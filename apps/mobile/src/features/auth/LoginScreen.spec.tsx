import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { LoginScreen } from './LoginScreen';
import { useAuth } from './context';
import { googleServerCode, googleSignInConfigured } from '../../services/googleSignIn';
import { t } from '../../services/locale';

jest.mock('expo-router', () => ({ Redirect: () => null }));
jest.mock('./context', () => ({ useAuth: jest.fn() }));
jest.mock('../../services/googleSignIn', () => ({
  googleServerCode: jest.fn(),
  googleSignInConfigured: jest.fn(),
  googleSignInNeedsDevelopmentBuild: jest.fn(() => false),
  prepareGoogleSignIn: jest.fn(() => Promise.resolve()),
}));

describe('V2 sign-in screen', () => {
  const loginGoogle = jest.fn();
  const loginPassword = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (googleSignInConfigured as jest.Mock).mockReturnValue(true);
    (useAuth as jest.Mock).mockReturnValue({
      state: { kind: 'signedOut' },
      loginGoogle,
      loginPassword,
    });
    loginGoogle.mockResolvedValue(undefined);
    loginPassword.mockResolvedValue(undefined);
  });

  it('does not establish a session when the user cancels', async () => {
    (googleServerCode as jest.Mock).mockResolvedValue(null);
    const screen = await render(<LoginScreen />);
    await fireEvent.press(screen.getByTestId('google-sign-in'));
    await waitFor(() => expect(googleServerCode).toHaveBeenCalledTimes(1));
    expect(loginGoogle).not.toHaveBeenCalled();
  });

  it('sends the native server authorization code to the API session', async () => {
    (googleServerCode as jest.Mock).mockResolvedValue('one-time-code');
    const screen = await render(<LoginScreen />);
    await fireEvent.press(screen.getByTestId('google-sign-in'));
    await waitFor(() => expect(loginGoogle).toHaveBeenCalledWith('one-time-code'));
  });

  it('keeps the V2 Google option actionable and the blocked WeChat option disabled', async () => {
    (googleServerCode as jest.Mock).mockResolvedValue('social-code');
    const screen = await render(<LoginScreen />);
    expect(
      screen.getByRole('button', { name: t('wechat') }).props.accessibilityState?.disabled,
    ).toBe(true);
    await fireEvent.press(screen.getByTestId('google-sign-in'));
    await waitFor(() => expect(loginGoogle).toHaveBeenCalledWith('social-code'));
  });

  it('submits username and password without invoking Google', async () => {
    const screen = await render(<LoginScreen />);
    await fireEvent.changeText(screen.getByTestId('login-username'), 'test_user');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'safe phrase 2026');
    await fireEvent.press(screen.getByTestId('password-sign-in'));
    await waitFor(() =>
      expect(loginPassword).toHaveBeenCalledWith('test_user', 'safe phrase 2026'),
    );
    expect(googleServerCode).not.toHaveBeenCalled();
  });

  it('does not send an invalid username or short password', async () => {
    const screen = await render(<LoginScreen />);
    await fireEvent.changeText(screen.getByTestId('login-username'), 'x');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'short');
    await fireEvent.press(screen.getByTestId('password-sign-in'));
    expect(loginPassword).not.toHaveBeenCalled();
    expect(screen.getByText(t('loginInputInvalid'))).toBeTruthy();
  });

  it('keeps Google actionable and explains missing configuration on press', async () => {
    (googleSignInConfigured as jest.Mock).mockReturnValue(false);
    const screen = await render(<LoginScreen />);
    expect(screen.getByTestId('google-sign-in').props.accessibilityState?.disabled).toBeFalsy();
    await fireEvent.press(screen.getByTestId('google-sign-in'));
    expect(googleServerCode).not.toHaveBeenCalled();
    expect(screen.getAllByText(t('configUnavailable')).length).toBeGreaterThan(0);
  });
});
