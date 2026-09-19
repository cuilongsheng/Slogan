import { randomUUID, createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';
import type { Environment } from '../../src/config/environment.js';
import { LivekitAdapter } from '../../src/infrastructure/livekit/livekit.adapter.js';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import type { RealtimeProvider, ProviderParticipant } from '../../src/modules/voice/index.js';
import { testEnvironment } from './environment.js';
export const realtimeEnvironment = () =>
  testEnvironment({
    REALTIME_ENABLED: true,
    LIVEKIT_URL: 'wss://isolated-test.livekit.cloud',
    LIVEKIT_API_KEY: 'test-key',
    LIVEKIT_API_SECRET: 'test-livekit-secret-with-at-least-32-characters',
    REDIS_URL: 'redis://127.0.0.1:56379/14',
  });
export class FakeRealtimeProvider implements RealtimeProvider {
  readonly signer = new LivekitAdapter(new ConfigService<Environment, true>(realtimeEnvironment()));
  roomSid: string | null = 'RM_test';
  connected: ProviderParticipant[] = [];
  revoked: string[] = [];
  deleted: string[] = [];
  tokenCalls = 0;
  fail = false;
  metadata: string | null = null;
  async ensureRoom(_roomId: string, _capacity: number, metadata: string) {
    this.metadata = metadata;
    return this.roomSid ?? 'RM_test';
  }
  async updateRoomMetadata(_roomId: string, metadata: string) {
    if (this.fail) throw new Error('test provider failure');
    if (!this.roomSid) return 'NOT_FOUND' as const;
    this.metadata = metadata;
    return 'UPDATED' as const;
  }
  token(roomId: string, identity: string, ttl: number) {
    this.tokenCalls += 1;
    return this.signer.token(roomId, identity, ttl);
  }
  async participants() {
    if (this.fail) throw new Error('test provider failure');
    return { roomSid: this.roomSid, participants: this.connected };
  }
  async revoke(_roomId: string, identity: string) {
    if (this.fail) throw new Error('test provider failure');
    this.revoked.push(identity);
  }
  async deleteRoom(roomId: string) {
    if (this.fail) throw new Error('test provider failure');
    this.deleted.push(roomId);
  }
  async sendData(_roomId: string, _payload: Uint8Array, _destinationIdentities: string[]) {
    if (this.fail) throw new Error('test provider failure');
  }
  verifyWebhook(body: string, authorization: string) {
    return this.signer.verifyWebhook(body, authorization);
  }
}
export async function signedWebhook(body: string) {
  const config = realtimeEnvironment();
  const token = new AccessToken(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET);
  token.sha256 = createHash('sha256').update(body).digest('base64');
  return token.toJwt();
}
export async function seedAdult(prisma: PrismaService, name = 'Test member') {
  return prisma.user.create({
    data: {
      id: randomUUID(),
      profile: {
        create: {
          displayName: name,
          avatarUrl: 'https://example.com/avatar.png',
          genderCode: 'prefer_not_to_say',
          nationalityCode: 'CN',
          interestCodes: ['testing'],
          cefrLevel: 'B1',
          birthYear: 2000,
          birthMonth: 1,
          completedAt: new Date(),
        },
      },
    },
  });
}
export async function clearRealtimeFixtures(prisma: PrismaService) {
  await prisma.vocabularyCommand.deleteMany();
  await prisma.vocabularyItem.deleteMany();
  await prisma.roomKeywordSummaryJob.deleteMany();
  await prisma.roomKeywordSummaryItem.deleteMany();
  await prisma.roomKeywordSummary.deleteMany();
  await prisma.roomSpeechAlertDelivery.deleteMany();
  await prisma.roomSpeechRiskEvent.deleteMany();
  await prisma.safetyCapabilityIncident.deleteMany();
  await prisma.aiUsageLedger.deleteMany();
  await prisma.aiExpressionRequest.deleteMany();
  await prisma.speechProcessingConsentEvent.deleteMany();
  await prisma.roomInvitation.deleteMany();
  await prisma.friendRequest.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.userBlock.deleteMany();
  await prisma.socialCommand.deleteMany();
  await prisma.safetyAppeal.deleteMany();
  await prisma.safetyRestriction.deleteMany();
  await prisma.safetyCaseActivity.deleteMany();
  await prisma.safetyCaseParticipantSnapshot.deleteMany();
  await prisma.safetyCase.deleteMany();
  await prisma.safetyCommand.deleteMany();
  await prisma.backofficeAuditEvent.deleteMany();
  await prisma.backofficeRoleAssignment.deleteMany();
  await prisma.roomEvent.deleteMany({ where: { reportId: { not: null } } });
  await prisma.report.deleteMany();
  await prisma.roomNote.deleteMany();
  await prisma.roomReservation.deleteMany();
  await prisma.room.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.accountLifecycleCommand.deleteMany();
  await prisma.phoneIdentity.deleteMany();
  await prisma.oAuthIdentity.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.roomEvent.deleteMany();
}
