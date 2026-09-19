import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../../../../config/environment.js';
import { PHONE_CHALLENGE_STORE, type PhoneChallengeStore } from '../../../auth/index.js';
import { SOCIAL_PRESENCE, type SocialPresence } from '../../../social/index.js';
import { AccountLifecycleError } from '../../domain/errors/account-lifecycle.error.js';
import {
  ACCOUNT_LIFECYCLE_REPOSITORY,
  type AccountLifecycleRepository,
} from '../../domain/ports/account-lifecycle.repository.js';

@Injectable()
export class AccountLifecycleService {
  constructor(
    @Inject(ACCOUNT_LIFECYCLE_REPOSITORY)
    private readonly repository: AccountLifecycleRepository,
    @Inject(PHONE_CHALLENGE_STORE) private readonly grants: PhoneChallengeStore,
    @Inject(SOCIAL_PRESENCE) private readonly presence: SocialPresence,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async deleteAccount(input: {
    userId: string;
    proof: string;
    confirmation: string;
    clientRequestId: string;
  }) {
    if (!this.config.get('ACCOUNT_LIFECYCLE_ENABLED', { infer: true })) {
      throw new AccountLifecycleError(
        'ACCOUNT_DELETE_UNAVAILABLE',
        'Account deletion is unavailable',
      );
    }
    if (input.confirmation !== 'DELETE MY ACCOUNT') {
      throw new AccountLifecycleError(
        'ACCOUNT_DELETE_CONFIRMATION_REQUIRED',
        'Explicit account deletion confirmation is required',
      );
    }
    const payloadHash = createHash('sha256')
      .update(JSON.stringify({ action: 'DELETE_ACCOUNT', confirmation: input.confirmation }))
      .digest('hex');
    const replay = await this.repository.findDeletionCommand(
      input.userId,
      input.clientRequestId,
      payloadHash,
    );
    if (replay) return replay;
    await this.grants.readGrant({
      grantId: input.proof,
      purpose: 'ACCOUNT_DELETE',
      userId: input.userId,
      clientRequestId: input.clientRequestId,
    });
    const result = await this.repository.deleteAccount({
      userId: input.userId,
      clientRequestId: input.clientRequestId,
      payloadHash,
      now: new Date(),
    });
    await this.grants.completeGrant(input.proof, input.clientRequestId);
    await this.presence.clear(input.userId);
    return result;
  }

  restrictedRecord(actorUserId: string, targetUserId: string, requestId?: string) {
    return this.repository.restrictedRecord({
      actorUserId,
      targetUserId,
      ...(requestId ? { requestId } : {}),
      now: new Date(),
    });
  }

  async purge(now = new Date()) {
    const before = new Date(
      now.getTime() -
        this.config.get('ACCOUNT_COMMAND_RETENTION_DAYS', { infer: true }) * 86_400_000,
    );
    const [commands, temporaryKeys] = await Promise.all([
      this.repository.purgeCommands(before),
      this.grants.cleanup(),
    ]);
    return { commands, temporaryKeys };
  }
}
