import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { RoomSpeechReadinessStore } from '../../src/infrastructure/redis/room-speech-readiness.service.js';
import { RoomRealtimeService, RoomsService } from '../../src/modules/rooms/index.js';
import { AppointmentsService } from '../../src/modules/rooms/testing.js';
import { PrismaAssistanceRepository } from '../../src/modules/assistance/testing.js';
import { PrismaRoomSpeechRepository } from '../../src/modules/speech-safety/infrastructure/prisma-room-speech.repository.js';
import { installTestEnvironment, testEnvironment } from '../fixtures/environment.js';
import { clearRealtimeFixtures, seedAdult } from '../fixtures/realtime.js';

describe('room speech safety persistence on PostgreSQL', () => {
  let ref: TestingModule;
  let prisma: PrismaService;
  let rooms: RoomsService;
  let appointments: AppointmentsService;
  let realtime: RoomRealtimeService;
  let repository: PrismaRoomSpeechRepository;
  let consentRepository: PrismaAssistanceRepository;
  let readiness: RoomSpeechReadinessStore;

  beforeAll(async () => {
    const environment = testEnvironment({
      ROOM_SPEECH_DETECTION_ENABLED: true,
      ROOM_SPEECH_HASH_SECRET: 'room-speech-test-secret-at-least-32-characters',
      REALTIME_ENABLED: true,
      LIVEKIT_URL: 'wss://isolated-test.livekit.cloud',
      LIVEKIT_API_KEY: 'test-key',
      LIVEKIT_API_SECRET: 'test-livekit-secret-with-at-least-32-characters',
      REDIS_URL: 'redis://127.0.0.1:56379/13',
      STT_PROVIDER_CATEGORY: 'TEST_STT',
      STT_BASE_URL: 'http://localhost:5555',
      STT_API_KEY: 'test-stt-key',
      STT_MODEL: 'test-stt',
      STT_REGION: 'local',
      STT_RETENTION_SECONDS: 0,
      STT_DELETION_MODE: 'NO_RETENTION',
      STT_STREAMING_MODE: 'SHORT_WINDOW',
    });
    installTestEnvironment(environment);
    ref = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService(environment))
      .compile();
    prisma = ref.get(PrismaService);
    rooms = ref.get(RoomsService);
    appointments = ref.get(AppointmentsService);
    realtime = ref.get(RoomRealtimeService);
    repository = ref.get(PrismaRoomSpeechRepository);
    consentRepository = ref.get(PrismaAssistanceRepository);
    readiness = ref.get(RoomSpeechReadinessStore);
    await prisma.$connect();
  });

  it('requires purpose-specific consent for creation and join, then revokes active access without a punishment', async () => {
    const host = await seedAdult(prisma, 'Consent host');
    const member = await seedAdult(prisma, 'Consent member');
    await readiness.clearReady();
    await expect(
      rooms.create(host.id, {
        topic: 'Unavailable speech room',
        cefrLevel: 'B1',
        capacity: 3,
        sensitiveSpeechDetectionEnabled: true,
      }),
    ).rejects.toMatchObject({ code: 'ROOM_SPEECH_UNAVAILABLE' });
    await readiness.markReady(60);
    await expect(
      rooms.create(host.id, {
        topic: 'Consent room',
        cefrLevel: 'B1',
        capacity: 3,
        sensitiveSpeechDetectionEnabled: true,
      }),
    ).rejects.toMatchObject({ code: 'ROOM_SPEECH_CONSENT_REQUIRED' });
    await consentRepository.consent({
      userId: host.id,
      clientRequestId: randomUUID(),
      purpose: 'ROOM_SAFETY_DETECTION',
      action: 'ACCEPT',
      noticeVersion: '2026-09-v1',
      providerCategory: 'TEST_STT',
      now: new Date(),
    });
    const room = await rooms.create(host.id, {
      topic: 'Consent room',
      cefrLevel: 'B1',
      capacity: 3,
      sensitiveSpeechDetectionEnabled: true,
    });
    expect(room.room.sensitiveSpeechDetectionEnabled).toBe(true);
    await expect(
      rooms.join(member.id, room.room.id, { rulesAccepted: true }),
    ).rejects.toMatchObject({ code: 'ROOM_SPEECH_CONSENT_REQUIRED' });
    expect(
      await prisma.roomMembership.count({ where: { roomId: room.room.id, userId: member.id } }),
    ).toBe(0);
    expect(await prisma.realtimeIssuance.count()).toBe(0);
    await consentRepository.consent({
      userId: member.id,
      clientRequestId: randomUUID(),
      purpose: 'ROOM_SAFETY_DETECTION',
      action: 'ACCEPT',
      noticeVersion: '2026-09-v1',
      providerCategory: 'TEST_STT',
      now: new Date(),
    });
    await rooms.join(member.id, room.room.id, { rulesAccepted: true });
    const membership = await prisma.roomMembership.findUniqueOrThrow({
      where: { roomId_userId: { roomId: room.room.id, userId: member.id } },
    });
    await prisma.realtimeIdentity.create({
      data: {
        identity: membership.participantIdentity,
        roomId: room.room.id,
        membershipId: membership.id,
        credentialVersion: membership.credentialVersion,
        issueUntil: new Date(Date.now() + 60_000),
      },
    });
    await consentRepository.consent({
      userId: member.id,
      clientRequestId: randomUUID(),
      purpose: 'ROOM_SAFETY_DETECTION',
      action: 'REVOKE',
      noticeVersion: '2026-09-v1',
      providerCategory: 'TEST_STT',
      now: new Date(),
    });
    expect(
      await prisma.roomMembership.findUniqueOrThrow({ where: { id: membership.id } }),
    ).toMatchObject({ lifecycle: 'LEFT', presence: 'DISCONNECTED' });
    expect(
      await prisma.realtimeIdentity.findUniqueOrThrow({
        where: { identity: membership.participantIdentity },
      }),
    ).toMatchObject({ revokedAt: expect.any(Date) });
    expect(await prisma.safetyRestriction.count({ where: { userId: member.id } })).toBe(0);
    expect(await prisma.safetyCase.count({ where: { targetUserId: member.id } })).toBe(0);
    await expect(realtime.reserveCredential(room.room.id, member.id)).rejects.toMatchObject({
      code: 'ROOM_SPEECH_CONSENT_REQUIRED',
    });
  });

  it('persists and projects the immutable setting for appointment rooms', async () => {
    const host = await seedAdult(prisma, 'Appointment speech host');
    await consentRepository.consent({
      userId: host.id,
      clientRequestId: randomUUID(),
      purpose: 'ROOM_SAFETY_DETECTION',
      action: 'ACCEPT',
      noticeVersion: '2026-09-v1',
      providerCategory: 'TEST_STT',
      now: new Date(),
    });
    const created = await appointments.create(host.id, {
      topic: 'Scheduled safety room',
      cefrLevel: 'B1',
      capacity: 3,
      startsAt: new Date(Date.now() + 600_000).toISOString(),
      endsAt: new Date(Date.now() + 3_600_000).toISOString(),
      sensitiveSpeechDetectionEnabled: true,
    });
    expect(created.sensitiveSpeechDetectionEnabled).toBe(true);
    await expect(appointments.detail(host.id, created.id)).resolves.toMatchObject({
      sensitiveSpeechDetectionEnabled: true,
    });
  });

  beforeEach(async () => {
    await clearRealtimeFixtures(prisma);
    await readiness.markReady(60);
  });

  afterAll(async () => {
    await clearRealtimeFixtures(prisma);
    await ref.close();
  });

  it('isolates consent, deduplicates minimal risk facts and scopes alerts to the current host', async () => {
    const host = await seedAdult(prisma, 'Speech host');
    const member = await seedAdult(prisma, 'Speech member');
    await consentRepository.consent({
      userId: host.id,
      clientRequestId: randomUUID(),
      purpose: 'ROOM_SAFETY_DETECTION',
      action: 'ACCEPT',
      noticeVersion: '2026-09-v1',
      providerCategory: 'TEST_STT',
      now: new Date(),
    });
    const room = await rooms.create(host.id, {
      topic: 'Safety language practice',
      cefrLevel: 'B1',
      capacity: 4,
      sensitiveSpeechDetectionEnabled: true,
    });
    await consentRepository.consent({
      userId: member.id,
      clientRequestId: randomUUID(),
      purpose: 'ROOM_SAFETY_DETECTION',
      action: 'ACCEPT',
      noticeVersion: '2026-09-v1',
      providerCategory: 'TEST_STT',
      now: new Date(),
    });
    await rooms.join(member.id, room.room.id, { rulesAccepted: true });
    const membership = await prisma.roomMembership.findUniqueOrThrow({
      where: { roomId_userId: { roomId: room.room.id, userId: member.id } },
    });
    await prisma.realtimeIdentity.create({
      data: {
        identity: membership.participantIdentity,
        roomId: room.room.id,
        membershipId: membership.id,
        credentialVersion: membership.credentialVersion,
        issueUntil: new Date(Date.now() + 60_000),
      },
    });
    const consent = await prisma.speechProcessingConsentEvent.findFirstOrThrow({
      where: { userId: member.id, purpose: 'ROOM_SAFETY_DETECTION' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const context = await repository.participant(
      room.room.id,
      membership.participantIdentity,
      '2026-09-v1',
    );
    expect(context).toMatchObject({ userId: member.id, consentGeneration: consent.id });
    await expect(
      prisma.room.update({
        where: { id: room.room.id },
        data: { sensitiveSpeechDetectionEnabled: false },
      }),
    ).rejects.toThrow('room speech detection setting is immutable after creation');

    const occurredAt = new Date();
    const first = await repository.recordRisk({
      context: context!,
      classification: {
        category: 'THREAT_VIOLENCE',
        severity: 'HIGH',
        ruleSetVersion: 'rules-v1',
      },
      correlationHash: 'a'.repeat(64),
      occurredAt,
      alertTtlSeconds: 600,
      fencingToken: 'fence-1',
    });
    await repository.recordRisk({
      context: context!,
      classification: {
        category: 'THREAT_VIOLENCE',
        severity: 'HIGH',
        ruleSetVersion: 'rules-v1',
      },
      correlationHash: 'a'.repeat(64),
      occurredAt: new Date(occurredAt.getTime() + 1000),
      alertTtlSeconds: 600,
      fencingToken: 'fence-1',
    });

    expect(await prisma.roomSpeechRiskEvent.count()).toBe(1);
    expect(await prisma.roomSpeechAlertDelivery.count()).toBe(1);
    expect(await prisma.safetyRestriction.count({ where: { userId: member.id } })).toBe(0);
    expect(await prisma.safetyCase.count({ where: { targetUserId: member.id } })).toBe(0);
    expect(
      await prisma.roomSpeechRiskEvent.findUniqueOrThrow({ where: { id: first.id } }),
    ).toMatchObject({ occurrenceCount: 2, subjectUserId: member.id });
    const hostPage = await repository.listHostAlerts({
      roomId: room.room.id,
      actorUserId: host.id,
      limit: 20,
      now: new Date(),
    });
    expect(hostPage.items).toHaveLength(1);
    expect(JSON.stringify(hostPage)).not.toMatch(/transcript|audio|attack/i);

    await prisma.room.update({ where: { id: room.room.id }, data: { hostUserId: member.id } });
    await expect(
      repository.listHostAlerts({
        roomId: room.room.id,
        actorUserId: host.id,
        limit: 20,
        now: new Date(),
      }),
    ).rejects.toMatchObject({ code: 'ROOM_HOST_REQUIRED' });
    await expect(
      repository.listHostAlerts({
        roomId: room.room.id,
        actorUserId: member.id,
        limit: 20,
        now: new Date(),
      }),
    ).resolves.toMatchObject({ items: [{ id: first.id }] });

    const initialClaim = (await repository.claimDeliveries())[0]!;
    await prisma.roomSpeechAlertDelivery.update({
      where: { id: initialClaim.id },
      data: { lockedUntil: new Date(Date.now() - 1) },
    });
    const replacementClaim = (await repository.claimDeliveries())[0]!;
    expect(replacementClaim.leaseId).not.toBe(initialClaim.leaseId);
    await expect(
      repository.resolveDeliveryTarget(replacementClaim.id, replacementClaim.leaseId),
    ).resolves.toBe(membership.participantIdentity);
    await repository.completeDelivery(initialClaim.id, initialClaim.leaseId, new Date());
    expect(
      await prisma.roomSpeechAlertDelivery.findUniqueOrThrow({
        where: { id: initialClaim.id },
      }),
    ).toMatchObject({ status: 'RUNNING', leaseId: replacementClaim.leaseId });
    await repository.completeDelivery(replacementClaim.id, replacementClaim.leaseId, new Date());
    expect(
      await prisma.roomSpeechAlertDelivery.findUniqueOrThrow({
        where: { id: replacementClaim.id },
      }),
    ).toMatchObject({ status: 'DELIVERED', leaseId: null });
  });

  it('merges continuous degradation and closes it on recovery', async () => {
    const auditor = await seedAdult(prisma, 'Incident auditor');
    const now = new Date();
    const first = await repository.openIncident({
      component: 'STREAMING_STT',
      errorCategory: 'PROVIDER_UNAVAILABLE',
      providerCategory: 'TEST_STT',
      now,
    });
    const second = await repository.openIncident({
      component: 'STREAMING_STT',
      errorCategory: 'PROVIDER_UNAVAILABLE',
      providerCategory: 'TEST_STT',
      now: new Date(now.getTime() + 1000),
    });
    expect(second.id).toBe(first.id);
    expect(second.affectedWindows).toBe(2);

    await repository.recoverIncident({
      component: 'STREAMING_STT',
      errorCategory: 'PROVIDER_UNAVAILABLE',
      now: new Date(now.getTime() + 2000),
    });
    await expect(
      repository.listIncidents({
        actorUserId: auditor.id,
        actorRoles: ['AUDITOR'],
        status: 'RECOVERED',
        limit: 20,
      }),
    ).resolves.toMatchObject({ items: [{ id: first.id, status: 'RECOVERED' }] });
  });

  it('purges only expired speech facts and preserves case and audit records', async () => {
    const host = await seedAdult(prisma, 'Retention host');
    const member = await seedAdult(prisma, 'Retention member');
    const room = await rooms.create(host.id, {
      topic: 'Retention checks',
      cefrLevel: 'B1',
      capacity: 3,
    });
    await rooms.join(member.id, room.room.id, { rulesAccepted: true });
    const old = new Date('2026-01-01T00:00:00.000Z');
    const recent = new Date('2026-09-16T00:00:00.000Z');
    const oldRisk = randomUUID();
    const recentRisk = randomUUID();
    for (const [id, at, hash] of [
      [oldRisk, old, 'c'.repeat(64)],
      [recentRisk, recent, 'd'.repeat(64)],
    ] as const)
      await prisma.roomSpeechRiskEvent.create({
        data: {
          id,
          roomId: room.room.id,
          subjectUserId: member.id,
          category: 'HARASSMENT_ABUSE',
          severity: 'MEDIUM',
          ruleSetVersion: 'rules-v1',
          correlationHash: hash,
          firstOccurredAt: at,
          lastOccurredAt: at,
          createdAt: at,
          deliveries: {
            create: {
              id: randomUUID(),
              status: 'DELIVERED',
              expiresAt: new Date(at.getTime() + 60_000),
              deliveredAt: at,
              createdAt: at,
            },
          },
        },
      });
    for (const at of [old, recent])
      await prisma.safetyCapabilityIncident.create({
        data: {
          id: randomUUID(),
          component: 'STREAMING_STT',
          errorCategory: 'RETENTION_TEST_' + at.getTime(),
          status: 'RECOVERED',
          startedAt: at,
          lastObservedAt: at,
          recoveredAt: at,
          createdAt: at,
        },
      });
    const report = await prisma.report.create({
      data: {
        id: randomUUID(),
        roomId: room.room.id,
        reporterUserId: host.id,
        targetUserId: member.id,
        clientRequestId: randomUUID(),
        category: 'OTHER',
        description: 'Retention fixture',
        submittedAt: old,
      },
    });
    await prisma.safetyCase.create({
      data: {
        id: randomUUID(),
        reportId: report.id,
        roomId: room.room.id,
        targetUserId: member.id,
        createdAt: old,
      },
    });
    await prisma.backofficeAuditEvent.create({
      data: {
        actorType: 'SYSTEM_JOB',
        actorRoles: [],
        action: 'SAFETY_CAPABILITY_INCIDENTS_VIEWED',
        targetType: 'RETENTION_FIXTURE',
        result: 'SUCCEEDED',
        occurredAt: old,
      },
    });

    await expect(repository.purge(new Date('2026-06-01T00:00:00.000Z'))).resolves.toEqual({
      risks: 1,
      incidents: 1,
      deliveries: 1,
    });
    expect(await prisma.roomSpeechRiskEvent.findMany({ select: { id: true } })).toEqual([
      { id: recentRisk },
    ]);
    expect(await prisma.safetyCapabilityIncident.count()).toBe(1);
    expect(await prisma.safetyCase.count()).toBe(1);
    expect(await prisma.backofficeAuditEvent.count()).toBe(1);
  });
});
