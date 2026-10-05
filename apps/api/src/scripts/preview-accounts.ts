import { readFile, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import {
  PreviewAccountsService,
  EmailAuthService,
  SessionService,
  type PreviewAccountInput,
} from '../modules/auth/index.js';
import { BackofficeService, BackofficeBootstrapCommand } from '../modules/backoffice/index.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}
function explicitTarget(): string {
  const environmentId = argument('--environment');
  const url = process.env.PREVIEW_DATABASE_URL;
  if (
    !url ||
    !environmentId ||
    environmentId !== process.env.PREVIEW_ENVIRONMENT_ID ||
    process.env.PREVIEW_ACCOUNTS_ENABLED !== 'true' ||
    process.env.EMAIL_PASSWORD_AUTH_ENABLED !== 'true'
  )
    throw new Error('PREVIEW_EXPLICIT_TARGET_REQUIRED');
  const parsed = new URL(url);
  if (
    !['postgresql:', 'postgres:'].includes(parsed.protocol) ||
    !parsed.hostname ||
    parsed.pathname === '/'
  )
    throw new Error('PREVIEW_TARGET_INVALID');
  process.env.DATABASE_URL = url;
  return environmentId;
}
async function inputs(): Promise<PreviewAccountInput[]> {
  const file = argument('--input');
  if (!file) throw new Error('PREVIEW_INPUT_REQUIRED');
  const path = resolve(file);
  const stat = await lstat(path);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    (stat.mode & 0o777) !== 0o600 ||
    (process.getuid && stat.uid !== process.getuid())
  )
    throw new Error('PREVIEW_INPUT_PERMISSIONS');
  const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (
    !Array.isArray(parsed) ||
    parsed.some(
      (a) =>
        !a ||
        typeof a !== 'object' ||
        typeof a.username !== 'string' ||
        typeof a.password !== 'string' ||
        typeof a.slot !== 'string',
    )
  )
    throw new Error('PREVIEW_INPUT_INVALID');
  return parsed as PreviewAccountInput[];
}
async function main() {
  const allowed = new Set([
    '--environment',
    '--input',
    '--action',
    '--api-url',
    '--authorization-mode',
    '--operator-input',
    '--backup',
  ]);
  if (
    process.argv.slice(2).some((value, i) => i % 2 === 0 && !allowed.has(value)) ||
    process.argv.length % 2 !== 0
  )
    throw new Error('PREVIEW_ARGUMENTS_INVALID');
  const environmentId = explicitTarget();
  const action = argument('--action');
  if (
    ![
      'dry-run',
      'initialize',
      'bootstrap',
      'roles',
      'status',
      'cancel-mail',
      'cleanup-local',
    ].includes(action ?? '')
  )
    throw new Error('PREVIEW_ACTION_REQUIRED');
  // Import only after selecting the explicit target. No copied .env or default datasource.
  const { AppModule } = await import('../app.module.js');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  let identity: Awaited<ReturnType<SessionService['verifyAccessToken']>> | undefined;
  try {
    const service = app.get(PreviewAccountsService);
    if (action === 'cleanup-local') {
      if (argument('--authorization-mode') !== 'local-rebuild')
        throw new Error('PREVIEW_LOCAL_AUTHORIZATION_REQUIRED');
      const { cleanupLocalPreviewAccounts } = await import('./local-preview-cleanup.js');
      const { PrismaService } = await import('../infrastructure/database/prisma.service.js');
      const { ACCOUNT_LIFECYCLE_REPOSITORY } =
        await import('../modules/account-lifecycle/index.js');
      const retired = await cleanupLocalPreviewAccounts(
        app.get(PrismaService),
        app.get(ACCOUNT_LIFECYCLE_REPOSITORY),
        {
          databaseUrl: process.env.PREVIEW_DATABASE_URL!,
          nodeEnvironment: process.env.NODE_ENV,
          environmentId,
          backupPath: argument('--backup'),
        },
      );
      process.stdout.write(JSON.stringify({ action, retired }) + '\n');
      return;
    }
    if (action === 'cancel-mail') {
      const { AuthMailService } = await import('../modules/auth/index.js');
      await app.get(AuthMailService).disablePending();
      process.stdout.write(JSON.stringify({ action, result: 'CANCELLED_WITHOUT_SENDING' }) + '\n');
      return;
    }
    if (action === 'initialize' || action === 'dry-run') {
      const result = await service.initialize(
        environmentId,
        await inputs(),
        action === 'dry-run',
        new Date(),
        argument('--authorization-mode') === 'existing-admin',
      );
      process.stdout.write(
        JSON.stringify({
          action,
          created: result.created,
          count: result.accounts.length,
          stage:
            result.accounts.every((a) => a.rolesCompletedAt) && result.accounts.length === 5
              ? 'READY'
              : 'ROLES_PENDING',
        }) + '\n',
      );
      return;
    }
    const accounts = await service.inspect(environmentId);
    if (accounts.length !== 5) throw new Error('PREVIEW_ACCOUNTS_NOT_INITIALIZED');
    const admin = accounts.find((a) => a.slot === 'ADMIN')!;
    const safety = accounts.find((a) => a.slot === 'SAFETY')!;
    if (action === 'bootstrap') {
      if (!admin.rolesCompletedAt) {
        if (admin.roles.length === 0)
          await app.get(BackofficeBootstrapCommand).execute(admin.userId);
        else if (
          JSON.stringify(admin.roles) !== JSON.stringify(['PLATFORM_ADMIN', 'SAFETY_OFFICER'])
        )
          throw new Error('PREVIEW_ROLE_PHASE_CONFLICT');
      }
    }
    if (action === 'roles') {
      if (accounts.every((a) => a.rolesCompletedAt)) {
        /* verified idempotent no-op */
      } else {
        const existingOperator = argument('--operator-input');
        const input = existingOperator
          ? undefined
          : (await inputs()).find((a) => a.slot === 'ADMIN');
        if (!existingOperator && (!input || input.username !== admin.username))
          throw new Error('PREVIEW_ADMIN_INPUT_MISMATCH');
        const api = new URL(argument('--api-url') ?? '');
        if (
          api.pathname !== '/' ||
          api.search ||
          api.hash ||
          api.username ||
          api.password ||
          !(
            api.protocol === 'https:' ||
            (api.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(api.hostname))
          )
        )
          throw new Error('PREVIEW_API_ORIGIN_INVALID');
        // Normal password authentication, quota and session checks; never trust a manifest actorId.
        let accessToken: string;
        if (existingOperator) {
          const stat = await lstat(existingOperator);
          if (
            !stat.isFile() ||
            stat.isSymbolicLink() ||
            (stat.mode & 0o777) !== 0o600 ||
            (process.getuid && stat.uid !== process.getuid())
          )
            throw new Error('PREVIEW_OPERATOR_PERMISSIONS');
          const parsed: unknown = JSON.parse(await readFile(existingOperator, 'utf8'));
          if (
            !parsed ||
            typeof parsed !== 'object' ||
            !('accessToken' in parsed) ||
            typeof parsed.accessToken !== 'string'
          )
            throw new Error('PREVIEW_OPERATOR_INPUT_INVALID');
          accessToken = parsed.accessToken;
        } else {
          const auth = await app
            .get(EmailAuthService)
            .login({ username: input!.username, password: input!.password }, 'preview-cli');
          accessToken = auth.tokens.accessToken;
        }
        identity = await app.get(SessionService).verifyAccessToken(accessToken);
        await app.get(BackofficeService).authorize(identity.userId, 'ROLE_ASSIGNMENTS_MANAGE');
        const commands = [
          ...(existingOperator
            ? [
                {
                  userId: admin.userId,
                  role: 'PLATFORM_ADMIN',
                  action: 'grant',
                  requestId: safety.grantCommandId,
                },
              ]
            : []),
          {
            userId: safety.userId,
            role: 'SAFETY_OFFICER',
            action: 'grant',
            requestId: admin.grantCommandId,
          },
          ...(admin.roles.includes('SAFETY_OFFICER')
            ? [
                {
                  userId: admin.userId,
                  role: 'SAFETY_OFFICER',
                  action: 'revoke',
                  requestId: admin.revokeCommandId,
                },
              ]
            : []),
        ];
        for (const command of commands) {
          const response = await fetch(
            new URL(
              `/v1/backoffice/users/${command.userId}/roles/${command.role}/${command.action}`,
              api,
            ),
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                clientRequestId: command.requestId,
                reason: 'Separate approved preview account roles',
              }),
              signal: AbortSignal.timeout(10000),
            },
          );
          if (!response.ok) throw new Error('PREVIEW_AUTHORIZED_ROLE_REQUEST_FAILED');
        }
        await service.completeRoles(environmentId);
      }
    }
    const state = await service.inspect(environmentId);
    process.stdout.write(
      JSON.stringify({
        action,
        stage: state.every((a) => a.rolesCompletedAt) ? 'READY' : 'ROLES_PENDING',
        accounts: state.map((a) => ({ slot: a.slot, roles: a.roles })),
      }) + '\n',
    );
  } finally {
    if (identity && !argument('--operator-input')) await app.get(SessionService).revoke(identity);
    await app.close();
  }
}
void main().catch(() => {
  process.stderr.write('PREVIEW_COMMAND_FAILED\n');
  process.exitCode = 1;
});
