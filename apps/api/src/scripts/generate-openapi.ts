import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import SwaggerParser from '@apidevtools/swagger-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIV3 } from 'openapi-types';
import { stringify } from 'yaml';

const contractPath = resolve(process.cwd(), '../../openapi/openapi.yaml');

Object.assign(process.env, {
  APP_NAME: 'slogan-api-contract',
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://slogan:slogan@127.0.0.1:5432/slogan_contract',
  CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
  JWT_ACCESS_SECRET: 'contract-only-access-secret-32-characters',
  REFRESH_TOKEN_PEPPER: 'contract-only-refresh-pepper-32-characters',
  ROOM_PASSWORD_PEPPER: 'contract-only-room-password-pepper-32-chars',
  ROOM_RULES_VERSION: '2026-09-v1',
  ROOM_SHARE_BASE_URL: 'http://localhost:5173/rooms/',
  REALTIME_ENABLED: 'false',
  GOOGLE_OAUTH_ENABLED: 'false',
  WECHAT_OAUTH_ENABLED: 'false',
});

async function generate(): Promise<void> {
  const { createApiApp } = await import('../bootstrap/create-api-app.js');
  const app = await createApiApp();
  try {
    const config = new DocumentBuilder()
      .setTitle('Slogan Voice Room API')
      .setDescription('Backend control-plane API for the adult English voice-room product.')
      .setVersion('0.0.1')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    await SwaggerParser.validate(document as unknown as OpenAPIV3.Document);
    const yaml = stringify(document, {
      aliasDuplicateObjects: false,
      sortMapEntries: true,
      lineWidth: 0,
    });

    if (process.argv.includes('--check')) {
      const current = await readFile(contractPath, 'utf8').catch(() => '');
      if (current !== yaml) {
        throw new Error(
          'openapi/openapi.yaml is out of date; run pnpm --filter @slogan/api openapi:generate',
        );
      }
      return;
    }
    await writeFile(contractPath, yaml, 'utf8');
  } finally {
    await app.close();
  }
}

void generate();
