export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

export interface SmsProvider {
  send(input: {
    to: string;
    code: string;
    template: string;
    sender: string;
    locale?: string;
    correlationId: string;
  }): Promise<void>;
}
