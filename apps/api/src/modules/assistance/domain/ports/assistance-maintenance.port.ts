export const ASSISTANCE_MAINTENANCE = Symbol('ASSISTANCE_MAINTENANCE');

export interface AssistanceMaintenance {
  scheduleExpiry(requestId: string, expiresAt: Date): Promise<void>;
}
