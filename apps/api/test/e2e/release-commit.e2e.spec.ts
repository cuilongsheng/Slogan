import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApiApp } from '../../src/bootstrap/create-api-app.js';
import { installTestEnvironment } from '../fixtures/environment.js';

describe('public deployment commit evidence', () => {
  const original = { ...process.env };
  afterAll(() => {
    process.env = original;
  });
  it.each([
    ['a'.repeat(40), 'a'.repeat(40)],
    ['injected\r\nheader', undefined],
    ['', undefined],
  ])('only exposes a valid source commit (%s)', async (commit, expected) => {
    installTestEnvironment();
    delete process.env.SLOGAN_RELEASE_COMMIT;
    process.env.VERCEL_GIT_COMMIT_SHA = commit;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    configureApiApp(app);
    try {
      await app.init();
      const response = await request(app.getHttpServer()).get('/v1/auth/capabilities').expect(200);
      expect(response.headers['x-slogan-commit']).toBe(expected);
      expect(response.body).toHaveProperty('password');
    } finally {
      await app.close();
    }
  });
});
