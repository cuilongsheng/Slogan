import { ConfigService } from '@nestjs/config';
import { fn } from 'jest-mock';
import { ObservabilityMonitorService } from '../../src/modules/operations/index.js';
import type { ObservabilityMonitorRepository } from '../../src/modules/operations/index.js';
import { testEnvironment } from '../fixtures/environment.js';
import type {
  OperationsDependencyProbes,
  IncidentsService,
} from '../../src/modules/operations/index.js';
import type { ObservabilityHeartbeat } from '../../src/infrastructure/observability/heartbeat.service.js';

function setup(enabled = true) {
  const claim = { environment: 'test', window: 10, leaseId: 'test-lease', generation: 1 };
  const repository = {
    claim: fn<ObservabilityMonitorRepository['claim']>().mockResolvedValue({
      kind: 'claimed',
      claim,
    }),
    record: fn<ObservabilityMonitorRepository['record']>().mockResolvedValue(undefined),
    complete: fn<ObservabilityMonitorRepository['complete']>().mockResolvedValue(undefined),
    release: fn<ObservabilityMonitorRepository['release']>().mockResolvedValue(undefined),
    backlog: fn<ObservabilityMonitorRepository['backlog']>().mockResolvedValue([]),
  };
  const probes = {
    check: fn<OperationsDependencyProbes['check']>().mockResolvedValue([
      {
        component: 'POSTGRESQL',
        enabled: true,
        ready: false,
        reasonCode: 'POSTGRESQL_UNAVAILABLE',
      },
    ]),
  };
  const incidents = {
    dispatchOne: fn<IncidentsService['dispatchOne']>().mockResolvedValue({ handled: false }),
  };
  const heartbeat = {
    completed: fn<ObservabilityHeartbeat['completed']>().mockResolvedValue(undefined),
  };
  const service = new ObservabilityMonitorService(
    repository as unknown as ObservabilityMonitorRepository,
    probes as never,
    incidents as never,
    new ConfigService(
      testEnvironment({
        OBSERVABILITY_MONITOR_ENABLED: enabled,
        OPERATIONS_GOVERNANCE_ENABLED: false,
      }),
    ),
    heartbeat as never,
    { schedule: async () => undefined },
  );
  const schedule = fn<ObservabilityMonitorService['schedule']>().mockResolvedValue(undefined);
  service.schedule = schedule;
  return { service, repository, probes, incidents, heartbeat, schedule };
}
describe('isolated monitoring lifecycle', () => {
  it('does nothing while disabled', async () => {
    const { service, probes, heartbeat } = setup(false);
    await service.process({ kind: 'monitor', window: 10 }, true);
    expect(probes.check).not.toHaveBeenCalled();
    expect(heartbeat.completed).not.toHaveBeenCalled();
  });
  it('runs probes/delivery with governance off and sends completion after durable continuation', async () => {
    const { service, repository, incidents, heartbeat, schedule } = setup();
    await service.process({ kind: 'monitor', window: 10 }, true);
    expect(incidents.dispatchOne).toHaveBeenCalled();
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(repository.complete).toHaveBeenCalled();
    expect(heartbeat.completed).toHaveBeenCalledWith('monitor');
    expect(schedule.mock.invocationCallOrder[0]).toBeLessThan(
      repository.complete.mock.invocationCallOrder[0]!,
    );
    expect(repository.complete.mock.invocationCallOrder[0]).toBeLessThan(
      heartbeat.completed.mock.invocationCallOrder[0]!,
    );
  });
  it('does not heartbeat a failed continuation and permits redelivery', async () => {
    const { service, repository, schedule, heartbeat } = setup();
    schedule.mockRejectedValueOnce(new Error('publish failed'));
    await expect(service.process({ kind: 'monitor', window: 10 }, true)).rejects.toThrow(
      'publish failed',
    );
    expect(repository.release).toHaveBeenCalled();
    expect(repository.complete).not.toHaveBeenCalled();
    expect(heartbeat.completed).not.toHaveBeenCalled();
  });
  it('does not produce a second scan chain for an old completed window', async () => {
    const { service, repository, schedule, heartbeat } = setup();
    repository.claim.mockResolvedValue({ kind: 'completed', nextWindow: null });
    await service.process({ kind: 'monitor', window: 10 }, true);
    expect(schedule).not.toHaveBeenCalled();
    expect(heartbeat.completed).not.toHaveBeenCalled();
  });
  it('republishes the same continuation if publish succeeded but completion failed', async () => {
    const { service, repository, schedule, heartbeat } = setup();
    repository.complete.mockRejectedValueOnce(new Error('commit failed'));
    await expect(service.process({ kind: 'monitor', window: 10 }, true)).rejects.toThrow(
      'commit failed',
    );
    const next = schedule.mock.calls[0]![0];
    await service.process({ kind: 'monitor', window: 10 }, true);
    expect(schedule.mock.calls[1]![0]).toBe(next);
    expect(heartbeat.completed).toHaveBeenCalledTimes(1);
    repository.claim.mockResolvedValue({ kind: 'completed', nextWindow: next });
    await service.process({ kind: 'monitor', window: 10 }, true);
    expect(schedule.mock.calls[2]![0]).toBe(next);
    expect(heartbeat.completed).toHaveBeenCalledTimes(1);
  });
  it('seeds the same current window without probing and stops continuation on disable', async () => {
    const { service, schedule, probes } = setup();
    await service.seed();
    await service.seed();
    expect(schedule.mock.calls[0]).toEqual(schedule.mock.calls[1]);
    expect(probes.check).not.toHaveBeenCalled();
    const disabled = setup(false);
    await disabled.service.seed();
    expect(disabled.schedule).not.toHaveBeenCalled();
  });
});
