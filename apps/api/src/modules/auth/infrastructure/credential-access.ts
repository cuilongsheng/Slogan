import type { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../config/environment.js';
import type {
  EmailCredential,
  PreviewAccountProvisioning,
} from '../../../generated/prisma/client.js';

type Credential = Pick<EmailCredential, 'origin' | 'verifiedAt' | 'passwordHash'>;
export function credentialAllowed(
  credential: Credential,
  mapping: PreviewAccountProvisioning | null,
  config?: ConfigService<Environment, true>,
): boolean {
  if (!credential.passwordHash) return false;
  if (credential.origin === 'EMAIL_VERIFIED')
    return credential.verifiedAt !== null && mapping === null;
  return (
    credential.origin === 'PREVIEW_PROVISIONED' &&
    credential.verifiedAt === null &&
    !!mapping &&
    mapping.retiredAt === null &&
    config?.get('PREVIEW_ACCOUNTS_ENABLED', { infer: true }) === true &&
    config.get('EMAIL_PASSWORD_AUTH_ENABLED', { infer: true }) === true &&
    config.get('PREVIEW_ENVIRONMENT_ID', { infer: true }) === mapping.environmentId
  );
}
export function previewUserAllowed(
  user: {
    emailCredential: Credential | null;
    previewAccount: PreviewAccountProvisioning | null;
  } | null,
  config?: ConfigService<Environment, true>,
): boolean {
  if (!user) return false;
  if (user.previewAccount || user.emailCredential?.origin === 'PREVIEW_PROVISIONED')
    return (
      !!user.emailCredential && credentialAllowed(user.emailCredential, user.previewAccount, config)
    );
  return true;
}
