import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import {
  ForgotPasswordScreen,
  RegisterScreen,
  ResetPasswordScreen,
  VerifyEmailScreen,
} from './EmailScreens';
import { confirmEmail, registerEmail, requestPasswordReset, resetPassword } from './emailApi';
import { useEmailFlow } from './emailFlow';
import { useEmailLinkToken } from './emailLink';
import { t } from '../../services/locale';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('./emailApi', () => ({
  confirmEmail: jest.fn(),
  emailAuthMessage: jest.fn(() => 'Request failed'),
  registerEmail: jest.fn(),
  requestPasswordReset: jest.fn(),
  resendEmail: jest.fn(),
  resetPassword: jest.fn(),
}));
jest.mock('./emailFlow', () => ({ useEmailFlow: jest.fn() }));
jest.mock('./emailLink', () => ({ useEmailLinkToken: jest.fn() }));

describe('email authentication screens', () => {
  const setEnrollment = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    (useEmailFlow as jest.Mock).mockReturnValue({ enrollment: null, setEnrollment });
    (useEmailLinkToken as jest.Mock).mockReturnValue(null);
  });

  it('validates registration locally then sends only the entered fields to the API', async () => {
    const screen = await render(<RegisterScreen />);
    await fireEvent.press(screen.getByTestId('registration-submit'));
    expect(registerEmail).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('registration-username'), 'member_26');
    await fireEvent.changeText(screen.getByTestId('registration-email'), 'member@example.test');
    await fireEvent.changeText(
      screen.getByTestId('registration-password'),
      'A strong phrase 2026!',
    );
    (registerEmail as jest.Mock).mockResolvedValue({
      managementToken: 'opaque',
      resendAt: '2026-10-01T00:00:00Z',
    });
    await fireEvent.press(screen.getByTestId('registration-submit'));
    await waitFor(() =>
      expect(registerEmail).toHaveBeenCalledWith({
        username: 'member_26',
        email: 'member@example.test',
        password: 'A strong phrase 2026!',
      }),
    );
    expect(setEnrollment).toHaveBeenCalledWith({
      email: 'member@example.test',
      managementToken: 'opaque',
      resendAt: '2026-10-01T00:00:00Z',
    });
    expect(router.replace).toHaveBeenCalledWith('/email/verify');
  });

  it('requires a verification link before confirming and does not claim success without it', async () => {
    const screen = await render(<VerifyEmailScreen />);
    await fireEvent.press(screen.getByTestId('verification-confirm'));
    expect(confirmEmail).not.toHaveBeenCalled();
    expect(screen.getByText(t('openVerificationLink'))).toBeTruthy();
  });

  it('confirms the link token only after the user presses confirm', async () => {
    (useEmailLinkToken as jest.Mock).mockReturnValue('t'.repeat(43));
    (confirmEmail as jest.Mock).mockResolvedValue(undefined);
    const screen = await render(<VerifyEmailScreen />);
    expect(useEmailLinkToken).toHaveBeenCalledWith('REGISTER');
    expect(confirmEmail).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('verification-confirm'));
    await waitFor(() => expect(confirmEmail).toHaveBeenCalledWith('t'.repeat(43)));
    expect(setEnrollment).toHaveBeenCalledWith(null);
  });

  it('shows the same recovery acceptance text after a valid request', async () => {
    (requestPasswordReset as jest.Mock).mockResolvedValue(undefined);
    const screen = await render(<ForgotPasswordScreen />);
    await fireEvent.changeText(screen.getByTestId('forgot-email'), 'member@example.test');
    await fireEvent.press(screen.getByTestId('forgot-submit'));
    await waitFor(() => expect(requestPasswordReset).toHaveBeenCalledWith('member@example.test'));
    expect(screen.getByText(t('resetRequestAccepted'))).toBeTruthy();
  });

  it('requires matching new passwords and submits the single-use reset token', async () => {
    (useEmailLinkToken as jest.Mock).mockReturnValue('r'.repeat(43));
    (resetPassword as jest.Mock).mockResolvedValue(undefined);
    const screen = await render(<ResetPasswordScreen />);
    await fireEvent.changeText(screen.getByTestId('reset-password'), 'New phrase 2026!');
    await fireEvent.changeText(screen.getByTestId('reset-repeat'), 'different password');
    await fireEvent.press(screen.getByTestId('reset-submit'));
    expect(resetPassword).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('reset-repeat'), 'New phrase 2026!');
    await fireEvent.press(screen.getByTestId('reset-submit'));
    await waitFor(() =>
      expect(resetPassword).toHaveBeenCalledWith('r'.repeat(43), 'New phrase 2026!'),
    );
    expect(screen.getByText(t('passwordUpdated'))).toBeTruthy();
  });
});
