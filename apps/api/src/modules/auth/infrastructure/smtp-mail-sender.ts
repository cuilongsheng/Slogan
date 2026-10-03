import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Environment } from '../../../config/environment.js';
import type { EmailMailPayload, MailSender } from '../domain/ports/email-security.port.js';

@Injectable()
export class SmtpMailSender implements MailSender {
  constructor(private readonly config: ConfigService<Environment, true>) {}
  async send(id: string, payload: EmailMailPayload): Promise<'SENT' | 'REJECTED' | 'UNCERTAIN'> {
    const local = this.config.get('EMAIL_SMTP_TLS_MODE', { infer: true }) === 'LOCAL_TEST';
    const timeout = this.config.get('EMAIL_SMTP_TIMEOUT_MS', { infer: true });
    const transporter = nodemailer.createTransport({
      host: this.config.get('EMAIL_SMTP_HOST', { infer: true }),
      port: this.config.get('EMAIL_SMTP_PORT', { infer: true }),
      secure: this.config.get('EMAIL_SMTP_TLS_MODE', { infer: true }) === 'TLS',
      requireTLS: !local,
      ignoreTLS: local,
      tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
      ...(local
        ? {}
        : {
            auth: {
              user: this.config.get('EMAIL_SMTP_USER', { infer: true })!,
              pass: this.config.get('EMAIL_SMTP_PASSWORD', { infer: true })!,
            },
          }),
      connectionTimeout: timeout,
      greetingTimeout: timeout,
      socketTimeout: timeout,
      logger: false,
      debug: false,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      const url = new URL(
        this.config.get(
          payload.purpose === 'RESET_PASSWORD' ? 'EMAIL_RESET_URL' : 'EMAIL_VERIFY_URL',
          { infer: true },
        )!,
      );
      url.hash = new URLSearchParams({ token: payload.token, purpose: payload.purpose }).toString();
      const sending = transporter.sendMail({
        from: this.config.get('EMAIL_SMTP_FROM', { infer: true }),
        to: payload.to,
        messageId: `<${id}@slogan-auth.invalid>`,
        subject:
          payload.purpose === 'RESET_PASSWORD'
            ? 'Reset your Slogan password'
            : 'Verify your Slogan email',
        text: `Open the trusted page and explicitly confirm this request:\n${url.toString()}\n\nOpening this link alone does not change your account. If you did not request this, ignore this email.`,
      });
      const response = await Promise.race([
        sending,
        new Promise<never>((_resolve, reject) => {
          deadline = setTimeout(() => {
            transporter.close();
            reject(new Error('SMTP_DEADLINE'));
          }, timeout);
        }),
      ]);
      return response.accepted.length > 0 ? 'SENT' : 'REJECTED';
    } catch (error) {
      const code =
        typeof error === 'object' && error && 'responseCode' in error
          ? Number(error.responseCode)
          : 0;
      return code >= 400 ? 'REJECTED' : 'UNCERTAIN';
    } finally {
      if (deadline) clearTimeout(deadline);
      transporter.close();
    }
  }
}
