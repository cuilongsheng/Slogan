export const EMAIL_SECURITY = Symbol('EMAIL_SECURITY');
export interface EmailMailPayload {
  to: string;
  token: string;
  purpose: 'REGISTER' | 'LINK' | 'RESET_PASSWORD';
}
export interface EmailSecurity {
  newToken(): string;
  digest(token: string): string;
  digests(token: string): string[];
  fingerprint(value: string): string;
  encrypt(id: string, payload: EmailMailPayload): { encryptedPayload: string; keyId: string };
  decrypt(id: string, encryptedPayload: string, keyId: string): EmailMailPayload;
}
export const EMAIL_QUOTA = Symbol('EMAIL_QUOTA');
export interface EmailQuota {
  consume(input: {
    source: string;
    target: string;
    mail: boolean;
    cooldown?: string;
  }): Promise<void>;
}
export const MAIL_SENDER = Symbol('MAIL_SENDER');
export interface MailSender {
  send(id: string, payload: EmailMailPayload): Promise<'SENT' | 'REJECTED' | 'UNCERTAIN'>;
}
