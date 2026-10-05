import type { ProfileData } from '../../../profiles/index.js';
export const PREVIEW_ACCOUNTS_REPOSITORY = Symbol('PREVIEW_ACCOUNTS_REPOSITORY');
export const PREVIEW_SLOTS = ['ADMIN', 'SAFETY', 'MOBILE_A', 'MOBILE_B', 'MOBILE_C'] as const;
export type PreviewSlot = (typeof PREVIEW_SLOTS)[number];
export interface PreviewAccountInput {
  slot: PreviewSlot;
  username: string;
  password: string;
  profile?: ProfileData;
}
export interface PreviewAccountState {
  slot: PreviewSlot;
  userId: string;
  username: string;
  roles: string[];
  grantCommandId: string;
  revokeCommandId: string;
  rolesCompletedAt: Date | null;
}
export interface PreviewAccountsRepository {
  inspect(environmentId: string): Promise<PreviewAccountState[]>;
  initialize(
    environmentId: string,
    accounts: Array<Omit<PreviewAccountInput, 'password'> & { passwordHash: string }>,
    dryRun: boolean,
    now: Date,
    existingAdmin?: boolean,
  ): Promise<{ created: boolean; accounts: PreviewAccountState[] }>;
  completeRoles(environmentId: string, now: Date): Promise<void>;
}
