import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { appendBackofficeAuditEvent } from '../../audit/persistence.js';
import {
  PUBLIC_TRIAL_USERNAMES,
  type PublicTrialRepository,
  type PublicTrialState,
} from '../domain/ports/public-trial.repository.js';
const conflict = () => new Error('PUBLIC_TRIAL_COLLISION_OR_RETIRED');
@Injectable()
export class PrismaPublicTrialRepository implements PublicTrialRepository {
  constructor(private readonly prisma: PrismaService) {}
  private async inspectIn(
    tx: Prisma.TransactionClient,
    environmentId: string,
  ): Promise<PublicTrialState[]> {
    const rows = await tx.publicTrialAccount.findMany({
      include: {
        user: {
          include: { emailCredential: true, backofficeRoles: { where: { revokedAt: null } } },
        },
      },
    });
    if (!rows.length) return [];
    if (
      rows.length !== 3 ||
      rows.some(
        (r) =>
          r.environmentId !== environmentId ||
          !PUBLIC_TRIAL_USERNAMES.includes(r.username as (typeof PUBLIC_TRIAL_USERNAMES)[number]) ||
          r.user.emailCredential?.username !== r.username ||
          r.user.emailCredential.origin !== 'PUBLIC_TRIAL_PROVISIONED',
      )
    )
      throw conflict();
    return rows.map((r) => ({
      userId: r.userId,
      username: r.username,
      disabled: r.disabledAt !== null || r.user.status !== 'ACTIVE',
      roles: r.user.backofficeRoles.map((role) => role.role),
    }));
  }
  inspect(environmentId: string) {
    return this.prisma.$transaction((tx) => this.inspectIn(tx, environmentId));
  }
  async provision(environmentId: string, passwordHash: string | null, now: Date) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(8121110)`;
        const existing = await this.inspectIn(tx, environmentId);
        if (existing.length) {
          if (
            existing.some(
              (r) =>
                r.disabled ||
                JSON.stringify(r.roles) !==
                  JSON.stringify(r.username === 'demo_m1' ? ['PUBLIC_TRIAL_VIEWER'] : []),
            )
          )
            throw conflict();
          return { created: false, accounts: existing };
        }
        if (
          (await tx.emailCredential.count({
            where: { username: { in: [...PUBLIC_TRIAL_USERNAMES] } },
          })) ||
          (await tx.emailEnrollment.count({
            where: {
              username: { in: [...PUBLIC_TRIAL_USERNAMES] },
              completedAt: null,
              expiresAt: { gt: now },
            },
          }))
        )
          throw conflict();
        if (passwordHash === null) return { created: false, accounts: [] };
        for (const username of PUBLIC_TRIAL_USERNAMES) {
          const userId = randomUUID();
          await tx.user.create({
            data: {
              id: userId,
              publicTrialAccount: { create: { username, environmentId, createdAt: now } },
              emailCredential: {
                create: {
                  username,
                  email: `${userId}@trial.invalid`,
                  passwordHash,
                  origin: 'PUBLIC_TRIAL_PROVISIONED',
                },
              },
              profile: {
                create: {
                  avatarUrl:
                    'https://raw.githubusercontent.com/cuilongsheng/Slogan/main/assets/brand/slogan-logo.png',
                  displayName:
                    username === 'demo_m1'
                      ? 'Public viewer'
                      : username === 'demo_s1'
                        ? 'Trial A'
                        : 'Trial B',
                  interestCodes: ['travel'],
                  cefrLevel: 'B1_B2',
                  adultConfirmedAt: now,
                  completedAt: now,
                },
              },
              ...(username === 'demo_m1'
                ? {
                    backofficeRoles: {
                      create: { id: randomUUID(), role: 'PUBLIC_TRIAL_VIEWER', grantedAt: now },
                    },
                  }
                : {}),
            },
          });
          await appendBackofficeAuditEvent(tx, {
            actorType: 'SYSTEM_JOB',
            actorRoles: [],
            action: 'ROLE_GRANTED',
            targetType: 'PUBLIC_TRIAL_ACCOUNT',
            targetId: userId,
            result: 'SUCCEEDED',
            reason: 'Owner-authorized public trial provisioning',
            details: { environmentId, username, readOnly: username === 'demo_m1' },
          });
        }
        return { created: true, accounts: await this.inspectIn(tx, environmentId) };
      },
      { timeout: 10000 },
    );
  }
  async disable(environmentId: string, now: Date) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(8121110)`;
      const accounts = await this.inspectIn(tx, environmentId);
      const userIds = accounts.map((a) => a.userId);
      await tx.publicTrialAccount.updateMany({
        where: { userId: { in: userIds }, disabledAt: null },
        data: { disabledAt: now },
      });
      await tx.user.updateMany({
        where: { id: { in: userIds }, status: 'ACTIVE' },
        data: { status: 'DISABLED' },
      });
      await tx.authSession.updateMany({
        where: { userId: { in: userIds }, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.backofficeRoleAssignment.updateMany({
        where: { userId: { in: userIds }, revokedAt: null },
        data: { revokedAt: now, version: { increment: 1 } },
      });
      for (const account of accounts.filter((a) => !a.disabled))
        await appendBackofficeAuditEvent(tx, {
          actorType: 'SYSTEM_JOB',
          actorRoles: [],
          action: 'ROLE_REVOKED',
          targetType: 'PUBLIC_TRIAL_ACCOUNT',
          targetId: account.userId,
          result: 'SUCCEEDED',
          reason: 'Owner-controlled public trial disable',
          details: { environmentId },
        });
      return accounts.length;
    });
  }
}
