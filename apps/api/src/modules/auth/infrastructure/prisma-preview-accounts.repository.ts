import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import {
  PREVIEW_SLOTS,
  type PreviewAccountsRepository,
  type PreviewAccountInput,
  type PreviewAccountState,
} from '../domain/ports/preview-accounts.repository.js';
import { EmailAuthError } from '../domain/errors/email-auth.error.js';

const conflict = () => new EmailAuthError('EMAIL_COMMAND_CONFLICT');
const expectedRoles = (slot: string): string[] =>
  slot === 'ADMIN' ? ['PLATFORM_ADMIN'] : slot === 'SAFETY' ? ['SAFETY_OFFICER'] : [];
@Injectable()
export class PrismaPreviewAccountsRepository implements PreviewAccountsRepository {
  constructor(private readonly prisma: PrismaService) {}
  private async inspectIn(
    tx: Prisma.TransactionClient,
    environmentId: string,
  ): Promise<PreviewAccountState[]> {
    const rows = await tx.previewAccountProvisioning.findMany({
      include: {
        user: {
          include: { emailCredential: true, backofficeRoles: { where: { revokedAt: null } } },
        },
      },
    });
    if (!rows.length) return [];
    if (
      rows.length !== 5 ||
      rows.some(
        (r) =>
          r.environmentId !== environmentId ||
          r.retiredAt ||
          r.user.status !== 'ACTIVE' ||
          r.user.emailCredential?.origin !== 'PREVIEW_PROVISIONED' ||
          r.user.emailCredential.verifiedAt !== null ||
          !r.user.emailCredential.passwordHash,
      )
    )
      throw conflict();
    const admins = await tx.backofficeRoleAssignment.findMany({
      where: { role: 'PLATFORM_ADMIN', revokedAt: null, user: { status: 'ACTIVE' } },
    });
    if (!admins.length && rows.some((r) => r.rolesCompletedAt)) throw conflict();
    return PREVIEW_SLOTS.map((slot) => {
      const row = rows.find((r) => r.slot === slot);
      if (!row) throw conflict();
      const roles = row.user.backofficeRoles.map((r) => r.role).sort();
      if (row.rolesCompletedAt && JSON.stringify(roles) !== JSON.stringify(expectedRoles(slot)))
        throw conflict();
      if (
        !row.rolesCompletedAt &&
        roles.some(
          (role) =>
            !expectedRoles(slot).includes(role) && !(slot === 'ADMIN' && role === 'SAFETY_OFFICER'),
        )
      )
        throw conflict();
      return {
        slot,
        userId: row.userId,
        username: row.user.emailCredential!.username,
        roles,
        grantCommandId: row.grantCommandId,
        revokeCommandId: row.revokeCommandId,
        rolesCompletedAt: row.rolesCompletedAt,
      };
    });
  }
  inspect(environmentId: string) {
    return this.prisma.$transaction((tx) => this.inspectIn(tx, environmentId));
  }
  async initialize(
    environmentId: string,
    accounts: Array<Omit<PreviewAccountInput, 'password'> & { passwordHash: string }>,
    dryRun: boolean,
    now: Date,
    existingAdmin = false,
  ) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(8121109)`;
          const existing = await this.inspectIn(tx, environmentId);
          if (existing.length) {
            if (
              existing.some((r) => accounts.find((a) => a.slot === r.slot)?.username !== r.username)
            )
              throw conflict();
            return { created: false, accounts: existing };
          }
          const adminCount = await tx.backofficeRoleAssignment.count({
            where: { role: 'PLATFORM_ADMIN', revokedAt: null, user: { status: 'ACTIVE' } },
          });
          if ((!existingAdmin && adminCount > 0) || (existingAdmin && adminCount === 0))
            throw conflict();
          if (
            (await tx.emailCredential.count({
              where: { username: { in: accounts.map((a) => a.username) } },
            })) ||
            (await tx.emailEnrollment.count({
              where: {
                username: { in: accounts.map((a) => a.username) },
                completedAt: null,
                expiresAt: { gt: now },
              },
            }))
          )
            throw conflict();
          if (dryRun) return { created: false, accounts: [] };
          const batchId = randomUUID();
          for (const account of accounts) {
            const userId = randomUUID();
            await tx.user.create({
              data: {
                id: userId,
                createdAt: now,
                updatedAt: now,
                ...(account.profile
                  ? { profile: { create: { ...account.profile, completedAt: now } } }
                  : {}),
                emailCredential: {
                  create: {
                    username: account.username,
                    email: userId + '@preview.invalid',
                    passwordHash: account.passwordHash,
                    origin: 'PREVIEW_PROVISIONED',
                    verifiedAt: null,
                  },
                },
                previewAccount: {
                  create: {
                    environmentId,
                    slot: account.slot,
                    batchId,
                    grantCommandId: randomUUID(),
                    revokeCommandId: randomUUID(),
                    createdAt: now,
                  },
                },
              },
            });
          }
          return { created: true, accounts: await this.inspectIn(tx, environmentId) };
        },
        { timeout: 10000 },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) throw conflict();
      throw error;
    }
  }
  async completeRoles(environmentId: string, now: Date) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(8121109)`;
      const rows = await this.inspectIn(tx, environmentId);
      if (
        rows.length !== 5 ||
        rows.some((r) => JSON.stringify(r.roles) !== JSON.stringify(expectedRoles(r.slot)))
      )
        throw conflict();
      await tx.previewAccountProvisioning.updateMany({
        where: { environmentId, rolesCompletedAt: null },
        data: { rolesCompletedAt: now },
      });
    });
  }
}
