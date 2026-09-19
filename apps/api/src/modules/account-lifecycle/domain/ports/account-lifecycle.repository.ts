import type {
  AccountDeletionResult,
  RestrictedAccountRecord,
} from '../entities/account-lifecycle.js';

export const ACCOUNT_LIFECYCLE_REPOSITORY = Symbol('ACCOUNT_LIFECYCLE_REPOSITORY');

export interface AccountLifecycleRepository {
  findDeletionCommand(
    userId: string,
    clientRequestId: string,
    payloadHash: string,
  ): Promise<AccountDeletionResult | null>;
  deleteAccount(input: {
    userId: string;
    clientRequestId: string;
    payloadHash: string;
    now: Date;
  }): Promise<AccountDeletionResult>;
  restrictedRecord(input: {
    actorUserId: string;
    targetUserId: string;
    requestId?: string;
    now: Date;
  }): Promise<RestrictedAccountRecord>;
  purgeCommands(before: Date): Promise<number>;
}
