import { ConfigService } from '@nestjs/config';
import { fn } from 'jest-mock';
import type { Environment } from '../../src/config/environment.js';
import {
  OperationsProbeService,
  type OperationsDependencyProbes,
} from '../../src/modules/operations/index.js';
import type { IncidentsService } from '../../src/modules/operations/index.js';
import { testEnvironment } from '../fixtures/environment.js';

describe('operations dependency probe threshold', () => {
  it('does not create an incident until the configured consecutive failure threshold', async () => {
    const check = fn<OperationsDependencyProbes['check']>().mockResolvedValue([
      { component: 'REDIS', enabled: true, ready: false, reasonCode: 'REDIS_UNAVAILABLE' },
    ]);
    const probes: OperationsDependencyProbes = { check };
    const observe = fn<IncidentsService['observe']>().mockResolvedValue({} as never);
    const recover = fn<IncidentsService['recover']>().mockResolvedValue(true);
    const service = new OperationsProbeService(
      probes,
      { observe, recover } as unknown as IncidentsService,
      new ConfigService<Environment, true>(
        testEnvironment({ OPERATIONS_INCIDENT_FAILURE_THRESHOLD: 3 }),
      ),
    );
    await service.run();
    await service.run();
    expect(observe).not.toHaveBeenCalled();
    await service.run();
    expect(observe).toHaveBeenCalledWith(
      expect.objectContaining({ component: 'REDIS', reasonCode: 'REDIS_UNAVAILABLE' }),
    );
    check.mockResolvedValue([{ component: 'REDIS', enabled: true, ready: true }]);
    await service.run();
    expect(recover).toHaveBeenCalledWith(
      expect.objectContaining({ component: 'REDIS', observedAt: expect.any(Date) }),
    );
  });
});
