import { ConfigService } from '@nestjs/config';
import { fn } from 'jest-mock';
import type { Environment } from '../../src/config/environment.js';
import {
  IncidentsService,
  type AlertDeliveryClaim,
  type IncidentsRepository,
  type OperationalAlertSink,
} from '../../src/modules/operations/index.js';
import { testEnvironment } from '../fixtures/environment.js';

const claim: AlertDeliveryClaim = {
  id: 'delivery',
  incidentId: 'incident',
  leaseId: 'lease',
  generation: 2,
  payload: {
    status: 'OPEN',
    component: 'REDIS',
    category: 'READINESS',
    severity: 'HIGH',
    scopeType: 'GLOBAL',
    reasonCode: 'REDIS_UNAVAILABLE',
    firstObservedAt: '2026-09-22T00:00:00.000Z',
  },
};

function fixture() {
  const repository = {
    claimDelivery: fn<IncidentsRepository['claimDelivery']>().mockResolvedValue(claim),
    completeDelivery: fn<IncidentsRepository['completeDelivery']>().mockResolvedValue(undefined),
    failDelivery: fn<IncidentsRepository['failDelivery']>().mockResolvedValue(undefined),
    trends: fn<IncidentsRepository['trends']>().mockResolvedValue([
      { component: 'REDIS', severity: 'HIGH', count: 1 },
      { component: 'STT', severity: 'WARNING', count: 10 },
    ]),
  } as unknown as IncidentsRepository;
  const send = fn<OperationalAlertSink['send']>().mockResolvedValue(undefined);
  const sink = { send } as OperationalAlertSink;
  const service = new IncidentsService(
    repository,
    sink,
    new ConfigService<Environment, true>(testEnvironment({ OPERATIONS_GOVERNANCE_ENABLED: true })),
  );
  return { repository, send, service };
}

describe('operational incident delivery and aggregate privacy', () => {
  it('keeps incident mutation unavailable while governance is disabled', () => {
    const service = new IncidentsService(
      {} as IncidentsRepository,
      {} as OperationalAlertSink,
      new ConfigService<Environment, true>(testEnvironment()),
    );
    expect(() =>
      service.command(
        '00000000-0000-4000-8000-000000000001',
        ['PLATFORM_ADMIN'],
        '00000000-0000-4000-8000-000000000002',
        'ACKNOWLEDGE',
        'investigating',
        '00000000-0000-4000-8000-000000000003',
      ),
    ).toThrow('Operations governance is unavailable');
  });

  it('fences a successful delivery and suppresses small aggregate groups', async () => {
    const { repository, send, service } = fixture();
    await expect(service.dispatchOne(new Date('2026-09-22T00:00:00Z'))).resolves.toEqual({
      handled: true,
      delivered: true,
    });
    expect(send).toHaveBeenCalledWith(claim.payload);
    expect(repository.completeDelivery).toHaveBeenCalledWith(claim, expect.any(Date));
    await expect(
      service.trends(new Date('2026-09-01T00:00:00Z'), new Date('2026-10-01T00:00:00Z')),
    ).resolves.toEqual([
      expect.objectContaining({ component: 'REDIS', count: null, suppressed: true, sampleSize: 1 }),
      expect.objectContaining({ component: 'STT', count: 10, suppressed: false, sampleSize: 10 }),
    ]);
  });

  it('keeps a failed or timed-out delivery retryable with a stable reason code', async () => {
    const { repository, send, service } = fixture();
    send.mockRejectedValueOnce(new Error('ALERT_SINK_TIMEOUT'));
    await expect(service.dispatchOne(new Date('2026-09-22T00:00:00Z'))).resolves.toEqual({
      handled: true,
      delivered: false,
    });
    expect(repository.completeDelivery).not.toHaveBeenCalled();
    expect(repository.failDelivery).toHaveBeenCalledWith(
      claim,
      'ALERT_SINK_TIMEOUT',
      expect.any(Date),
    );
  });
});
