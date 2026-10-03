import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { RoomServiceClient } from 'livekit-server-sdk';
import type { Environment } from '../../../config/environment.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import type {
  DependencyProbeResult,
  OperationsDependencyProbes,
} from '../domain/ports/dependency-probes.port.js';

@Injectable()
export class NetworkOperationsDependencyProbes
  implements OperationsDependencyProbes, OnModuleDestroy
{
  private redis: Redis | undefined;
  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly prisma: PrismaService,
  ) {}

  async check(): Promise<DependencyProbeResult[]> {
    return Promise.all([
      this.postgresqlProbe(),
      this.redisProbe(),
      this.livekitProbe(),
      this.httpProbe(
        'AI',
        this.config.get('ASSISTANCE_ENABLED', { infer: true }),
        this.config.get('AI_EXPRESSION_BASE_URL', { infer: true }),
        this.config.get('AI_EXPRESSION_API_KEY', { infer: true }),
      ),
      this.httpProbe(
        'STT',
        this.config.get('ASSISTANCE_AUDIO_ENABLED', { infer: true }) ||
          this.config.get('ROOM_SPEECH_DETECTION_ENABLED', { infer: true }) ||
          this.config.get('POST_ROOM_KEYWORDS_ENABLED', { infer: true }),
        this.config.get('STT_BASE_URL', { infer: true }),
        this.config.get('STT_API_KEY', { infer: true }),
      ),
      this.httpProbe(
        'SMS',
        this.config.get('PHONE_AUTH_ENABLED', { infer: true }),
        this.config.get('SMS_PROVIDER_BASE_URL', { infer: true }),
        this.config.get('SMS_PROVIDER_API_KEY', { infer: true }),
      ),
    ]);
  }

  private async postgresqlProbe(): Promise<DependencyProbeResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { component: 'POSTGRESQL', enabled: true, ready: true };
    } catch {
      return {
        component: 'POSTGRESQL',
        enabled: true,
        ready: false,
        reasonCode: 'POSTGRESQL_UNAVAILABLE',
      };
    }
  }

  async onModuleDestroy() {
    this.redis?.disconnect();
  }

  private async redisProbe(): Promise<DependencyProbeResult> {
    const url = this.config.get('REDIS_URL', { infer: true });
    if (!url) return { component: 'REDIS', enabled: false, ready: true };
    try {
      this.redis ??= new Redis(url, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 2_000,
      });
      if (['wait', 'end'].includes(this.redis.status)) await this.redis.connect();
      await this.redis.ping();
      return { component: 'REDIS', enabled: true, ready: true };
    } catch {
      this.redis?.disconnect();
      this.redis = undefined;
      return { component: 'REDIS', enabled: true, ready: false, reasonCode: 'REDIS_UNAVAILABLE' };
    }
  }

  private async livekitProbe(): Promise<DependencyProbeResult> {
    if (!this.config.get('REALTIME_ENABLED', { infer: true }))
      return { component: 'LIVEKIT', enabled: false, ready: true };
    try {
      const client = new RoomServiceClient(
        this.config.get('LIVEKIT_URL', { infer: true })!.replace('wss:', 'https:'),
        this.config.get('LIVEKIT_API_KEY', { infer: true }),
        this.config.get('LIVEKIT_API_SECRET', { infer: true }),
        { requestTimeout: 3, failover: false },
      );
      await client.listRooms([]);
      return { component: 'LIVEKIT', enabled: true, ready: true };
    } catch {
      return {
        component: 'LIVEKIT',
        enabled: true,
        ready: false,
        reasonCode: 'LIVEKIT_UNAVAILABLE',
      };
    }
  }

  private async httpProbe(
    component: 'AI' | 'STT' | 'SMS',
    enabled: boolean,
    url?: string,
    token?: string,
  ): Promise<DependencyProbeResult> {
    if (!enabled) return { component, enabled: false, ready: true };
    if (!url || !token)
      return {
        component,
        enabled: true,
        ready: false,
        reasonCode: `${component}_CONFIGURATION_INVALID`,
      };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: { authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      return response.status < 500
        ? { component, enabled: true, ready: true }
        : { component, enabled: true, ready: false, reasonCode: `${component}_UNAVAILABLE` };
    } catch {
      return { component, enabled: true, ready: false, reasonCode: `${component}_UNAVAILABLE` };
    } finally {
      clearTimeout(timeout);
    }
  }
}
