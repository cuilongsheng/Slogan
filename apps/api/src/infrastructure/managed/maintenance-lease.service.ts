import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

/** Database lease is shared by all managed consumers, including duplicate deliveries. */
@Injectable()
export class MaintenanceLease {
  constructor(private readonly prisma: PrismaService) {}
  async claim(key: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.managedMaintenanceLease.upsert({ where: { key }, create: { key }, update: {} });
      const leaseId = randomUUID();
      const updated = await tx.managedMaintenanceLease.updateMany({
        where: { key, OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }] },
        data: {
          leaseId,
          lockedUntil: new Date(Date.now() + 315_000),
          generation: { increment: 1 },
        },
      });
      if (!updated.count) return null;
      const row = await tx.managedMaintenanceLease.findUniqueOrThrow({ where: { key } });
      return { key, leaseId, generation: row.generation };
    });
  }
  async finish(claim: { key: string; leaseId: string; generation: number }, success: boolean) {
    await this.prisma.managedMaintenanceLease.updateMany({
      where: claim,
      data: {
        leaseId: null,
        lockedUntil: null,
        lastCompletedAt: new Date(),
        ...(success ? { lastSucceededAt: new Date() } : {}),
      },
    });
  }
}
