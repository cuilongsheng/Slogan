import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { HealthModule } from '../../src/modules/health/health.module.js';
import { HealthService } from '../../src/modules/health/health.service.js';
import { ConfigService } from '@nestjs/config';
import { StructuredLogger } from '../../src/infrastructure/observability/structured-logger.service.js';
import { configureApiApp } from '../../src/bootstrap/create-api-app.js';
import { testEnvironment } from '../fixtures/environment.js';

describe('anonymous health contract', () => {
  let app: INestApplication;
  let ready = true;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [HealthModule],
      providers: [
        { provide: ConfigService, useValue: new ConfigService(testEnvironment()) },
        StructuredLogger,
      ],
    })
      .overrideProvider(HealthService)
      .useValue({ ready: async () => ready })
      .compile();
    app = module.createNestApplication();
    configureApiApp(app);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('distinguishes a live process from unavailable persistence without diagnostic leakage', async () => {
    const live = await request(app.getHttpServer()).get('/v1/health/live').expect(200);
    expect(live.body).toEqual({ status: 'ok' });
    expect(live.headers['cache-control']).toBe('no-store');
    await request(app.getHttpServer()).get('/v1/health/ready').expect(200, { status: 'ready' });
    ready = false;
    const result = await request(app.getHttpServer()).get('/v1/health/ready').expect(503);
    expect(result.body).toEqual({ status: 'not_ready' });
    expect(result.headers['cache-control']).toBe('no-store');
  });
  it('isolates concurrent request identifiers and exposes only generated or legal correlation', async () => {
    const identifiers = [
      'a1b2c3d4-e5f6-4abc-8def-123456789abc',
      'b1b2c3d4-e5f6-4abc-8def-123456789abc',
    ];
    const results = await Promise.all(
      [...identifiers, 'PRIVATE_CANARY'].map((id) =>
        request(app.getHttpServer())
          .get('/v1/health/live')
          .set('x-request-id', id)
          .set('origin', 'http://localhost:5173')
          .expect(200),
      ),
    );
    expect(results.slice(0, 2).map((result) => result.headers['x-request-id'])).toEqual(
      identifiers,
    );
    expect(results[2]!.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/);
    expect(results[2]!.headers['x-request-id']).not.toBe('PRIVATE_CANARY');
    expect(results[2]!.headers['access-control-expose-headers']).toBe('x-request-id');
  });
});
