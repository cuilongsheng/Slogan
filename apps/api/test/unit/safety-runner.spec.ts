import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../src/config/environment.js';
import type { StructuredLogger } from '../../src/infrastructure/observability/structured-logger.service.js';
import type { SafetyRepository } from '../../src/modules/safety/domain/ports/safety.repository.js';
import { SafetyQueue } from '../../src/modules/safety/infrastructure/safety-queue.service.js';
import { SafetyRunner } from '../../src/modules/safety/infrastructure/safety-runner.service.js';
import { testEnvironment } from '../fixtures/environment.js';

describe('SafetyRunner without Redis', () => {
  it('starts, scans PostgreSQL-backed work and does not log job contents', async () => {
    const warnings: unknown[] = [];
    const logger = {
      warn(value: unknown) {
        warnings.push(value);
      },
    } as StructuredLogger;
    const config = new ConfigService<Environment, true>(testEnvironment());
    let recovered = 0;
    let scanned = 0;
    const unused = async () => undefined;
    const repository: SafetyRepository = {
      listCases: unused,
      caseDetail: unused,
      evidence: unused,
      claim: unused,
      start: unused,
      dismiss: unused,
      resolve: unused,
      listRestrictions: unused,
      listOwnRestrictions: unused,
      lift: unused,
      appeal: unused,
      listAppeals: unused,
      decideAppeal: unused,
      expire: async () => false,
      recoverAssignments: async () => {
        recovered += 1;
        return 0;
      },
      recoverableRestrictionIds: async () => {
        scanned += 1;
        return [];
      },
    };
    const queue = new SafetyQueue(config, logger);
    const runner = new SafetyRunner(queue, repository, logger);

    await runner.onModuleInit();
    await runner.recover();
    await runner.onModuleDestroy();

    expect(recovered).toBeGreaterThan(0);
    expect(scanned).toBeGreaterThan(0);
    expect(warnings).toEqual([]);
  });
});
