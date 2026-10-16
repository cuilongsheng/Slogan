import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pg from 'pg';
import type { Environment } from '../../config/environment.js';

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly pool: pg.Pool;
  private closing: Promise<void> | undefined;
  constructor(config: ConfigService<Environment, true>) {
    this.pool = new pg.Pool({
      connectionString: config.get('DATABASE_URL', { infer: true }),
      max: 1,
      connectionTimeoutMillis: 2000,
      query_timeout: 2000,
      statement_timeout: 2000,
      idleTimeoutMillis: 5000,
      allowExitOnIdle: true,
    });
    this.pool.on('error', () => undefined);
  }
  async ready(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
  async onModuleDestroy(): Promise<void> {
    this.closing ??= this.pool.end();
    await this.closing;
  }
}
