import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { BackofficeBootstrapCommand } from '../modules/backoffice/index.js';

function userIdArgument(): string {
  const index = process.argv.indexOf('--user-id');
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (
    !value ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new Error('Usage: bootstrap-backoffice --user-id <uuid>');
  }
  return value;
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const userId = userIdArgument();
    const result = await app.get(BackofficeBootstrapCommand).execute(userId);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : 'BOOTSTRAP_FAILED';
  process.stderr.write(`${JSON.stringify({ code })}\n`);
  process.exitCode = 1;
});
