import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
export interface WorkHints {
  outbox: boolean;
  realtime: boolean;
  direct: boolean;
  safety: boolean;
}
/** One scalar result, no transaction or entity graph when the database is idle. */
@Injectable()
export class WorkHintsService {
  constructor(private readonly prisma: PrismaService) {}
  async read(includeRooms = true): Promise<WorkHints> {
    const [hint] = await this.prisma.$queryRaw<WorkHints[]>`SELECT
      EXISTS(SELECT 1 FROM "LiveUpdateOutbox" LIMIT 1) AS outbox,
      (${includeRooms} AND EXISTS(SELECT 1 FROM "Room" WHERE status IN ('SCHEDULED','OPEN','ENDING') LIMIT 1)
       OR EXISTS(SELECT 1 FROM "RealtimeCommand" WHERE status IN ('PENDING','RUNNING') LIMIT 1)) AS realtime,
      EXISTS(SELECT 1 FROM "DirectCall" WHERE status IN ('RINGING','ACTIVE') OR "cleanupStatus" IN ('PENDING','RUNNING') LIMIT 1) AS direct,
      (EXISTS(SELECT 1 FROM "SafetyCase" WHERE status IN ('OPEN','UNDER_REVIEW') LIMIT 1)
       OR EXISTS(SELECT 1 FROM "SafetyRestriction" WHERE status='ACTIVE' AND kind='TEMPORARY' AND "endsAt" IS NOT NULL LIMIT 1)) AS safety`;
    return hint!;
  }
}
