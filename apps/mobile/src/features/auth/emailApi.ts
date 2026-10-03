import type { SloganApiPaths } from '@slogan/api-client';
import { createMobileApiClient } from '../../api/client';
import { t } from '../../services/locale';

type Registration =
  SloganApiPaths['/v1/auth/email/registrations']['post']['requestBody']['content']['application/json'];
type RegistrationResult =
  SloganApiPaths['/v1/auth/email/registrations']['post']['responses'][202]['content']['application/json'];

export class EmailAuthRequestError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
  }
}

function failed(status: number, error: unknown): never {
  const code =
    error && typeof error === 'object' && 'code' in error ? String(error.code) : 'REQUEST_FAILED';
  throw new EmailAuthRequestError(code, status);
}

export async function registerEmail(body: Registration): Promise<RegistrationResult> {
  const { data, error, response } = await createMobileApiClient().POST(
    '/v1/auth/email/registrations',
    {
      body,
    },
  );
  if (!data) failed(response.status, error);
  return data;
}

export async function resendEmail(managementToken: string): Promise<string> {
  const { data, error, response } = await createMobileApiClient().POST(
    '/v1/auth/email/verifications/resend',
    { body: { managementToken } },
  );
  if (!data) failed(response.status, error);
  return data.resendAt;
}

export async function confirmEmail(token: string): Promise<void> {
  const { data, error, response } = await createMobileApiClient().POST(
    '/v1/auth/email/verifications/confirm',
    { body: { token } },
  );
  if (!data) failed(response.status, error);
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { data, error, response } = await createMobileApiClient().POST(
    '/v1/auth/password/reset-requests',
    { body: { email } },
  );
  if (!data) failed(response.status, error);
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const { error, response } = await createMobileApiClient().POST('/v1/auth/password/resets', {
    body: { token, password },
  });
  if (response.status !== 204) failed(response.status, error);
}

export function emailAuthMessage(error: unknown): string {
  const code =
    typeof error === 'string'
      ? error
      : error instanceof EmailAuthRequestError
        ? error.code
        : 'REQUEST_FAILED';
  switch (code) {
    case 'EMAIL_USERNAME_INVALID':
      return t('emailUsernameInvalid');
    case 'EMAIL_ADDRESS_INVALID':
      return t('emailAddressInvalid');
    case 'EMAIL_PASSWORD_INVALID':
      return t('emailPasswordInvalid');
    case 'EMAIL_PASSWORD_WEAK':
      return t('emailPasswordWeak');
    case 'EMAIL_USERNAME_TAKEN':
      return t('emailUsernameTaken');
    case 'EMAIL_ADDRESS_TAKEN':
      return t('emailAddressTaken');
    case 'EMAIL_VERIFICATION_REQUIRED':
      return t('emailVerificationRequired');
    case 'EMAIL_TOKEN_INVALID':
      return t('emailTokenInvalid');
    case 'EMAIL_CREDENTIALS_INVALID':
      return t('emailCredentialsInvalid');
    case 'EMAIL_AUTH_RATE_LIMITED':
      return t('emailRateLimited');
    case 'EMAIL_AUTH_UNAVAILABLE':
      return t('emailUnavailable');
    default:
      return t('emailRequestFailed');
  }
}
