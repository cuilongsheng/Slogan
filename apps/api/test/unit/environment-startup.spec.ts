import { validateEnvironment } from '../../src/config/environment.js';
import { rawTestEnvironment } from '../fixtures/environment.js';

describe('local API startup environment', () => {
  it('accepts blank optional provider and backup fields while those features are disabled', () => {
    const environment = validateEnvironment(
      rawTestEnvironment({
        AI_EXPRESSION_DATA_USE: '',
        STT_DATA_USE: '',
        STT_DELETION_MODE: '',
        STT_STREAMING_MODE: '',
        BACKUP_RETENTION_COUNT: '',
        BACKUP_RPO_SECONDS: '',
        BACKUP_RTO_SECONDS: '',
      }),
    );
    expect(environment.APP_HOST).toBe('127.0.0.1');
    expect(environment.BACKUP_RETENTION_COUNT).toBeUndefined();
  });

  it('allows explicit LAN listening and rejects an unexpected bind address', () => {
    expect(validateEnvironment(rawTestEnvironment({ APP_HOST: '0.0.0.0' })).APP_HOST).toBe(
      '0.0.0.0',
    );
    expect(() => validateEnvironment(rawTestEnvironment({ APP_HOST: '192.0.2.10' }))).toThrow();
  });
});
