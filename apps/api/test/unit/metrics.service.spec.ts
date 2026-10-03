import { ConfigService } from '@nestjs/config';
import { fn } from 'jest-mock';
import type { Environment } from '../../src/config/environment.js';
import { MetricsService, type MetricsRepository } from '../../src/modules/operations/index.js';
import { testEnvironment } from '../fixtures/environment.js';

describe('metrics privacy projection', () => {
  it('suppresses numerator, denominator and value below k=10 while retaining stable status', async () => {
    const generatedAt = new Date();
    const repository = {
      list: fn<MetricsRepository['list']>().mockResolvedValue({
        items: [
          {
            id: 'small',
            metricKey: 'FIVE_MINUTE_CONVERSATION_RATE',
            grain: 'DAY',
            windowStart: new Date('2026-09-01'),
            windowEnd: new Date('2026-09-02'),
            dimensions: { CEFR: 'C2' },
            definitionVersion: 'v1',
            status: 'COMPLETE',
            value: 0.5,
            numerator: 4n,
            denominator: 8n,
            sampleSize: 8,
            dataThroughAt: generatedAt,
            generatedAt,
            suppressed: false,
          },
          {
            id: 'large',
            metricKey: 'FIVE_MINUTE_CONVERSATION_RATE',
            grain: 'DAY',
            windowStart: new Date('2026-09-01'),
            windowEnd: new Date('2026-09-02'),
            dimensions: { CEFR: 'B1' },
            definitionVersion: 'v1',
            status: 'COMPLETE',
            value: 0.5,
            numerator: 5n,
            denominator: 10n,
            sampleSize: 10,
            dataThroughAt: generatedAt,
            generatedAt,
            suppressed: false,
          },
        ],
        nextCursor: null,
      }),
    } as unknown as MetricsRepository;
    const service = new MetricsService(
      repository,
      new ConfigService<Environment, true>(testEnvironment()),
    );
    const result = await service.list('actor', ['OPERATIONS_ANALYST'], {
      from: new Date('2026-09-01'),
      to: new Date('2026-09-03'),
      limit: 20,
    });
    expect(result.items[0]).toMatchObject({
      suppressed: true,
      value: null,
      numerator: null,
      denominator: null,
      reasonCode: 'MINIMUM_SAMPLE_SUPPRESSED',
    });
    expect(result.items[1]).toMatchObject({
      suppressed: false,
      value: 0.5,
      numerator: '5',
      denominator: '10',
    });
  });

  it('rejects reversed and excessive query ranges before touching storage', async () => {
    const repository = { list: fn<MetricsRepository['list']>() } as unknown as MetricsRepository;
    const service = new MetricsService(
      repository,
      new ConfigService<Environment, true>(testEnvironment()),
    );
    await expect(
      service.list('actor', ['PLATFORM_ADMIN'], {
        from: new Date('2026-09-02'),
        to: new Date('2026-09-01'),
        limit: 20,
      }),
    ).rejects.toMatchObject({ code: 'OPERATIONS_VALIDATION_FAILED' });
    expect(repository.list).not.toHaveBeenCalled();
  });
});
