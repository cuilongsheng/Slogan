export const EMAIL_DELIVERY_REPOSITORY = Symbol('EMAIL_DELIVERY_REPOSITORY');
export interface ClaimedEmailDelivery {
  id: string;
  generation: number;
  encryptedPayload: string;
  keyId: string;
}
export interface EmailDeliveryRepository {
  claim(now: Date): Promise<ClaimedEmailDelivery[]>;
  settle(
    id: string,
    generation: number,
    result: 'SENT' | 'REJECTED' | 'UNCERTAIN' | 'INVALID_PAYLOAD',
    now: Date,
  ): Promise<void>;
  cleanup(now: Date): Promise<void>;
}
