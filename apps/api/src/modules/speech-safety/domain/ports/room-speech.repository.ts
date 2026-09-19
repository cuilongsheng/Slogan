import type {
  RoomSpeechAlert,
  RiskClassification,
  SafetyCapabilityComponent,
  SafetyCapabilityIncidentView,
  SpeechParticipantContext,
} from '../entities/room-speech-safety.js';

export const ROOM_SPEECH_REPOSITORY = Symbol('ROOM_SPEECH_REPOSITORY');

export interface RoomSpeechRepository {
  activeRooms(now?: Date): Promise<Array<{ id: string; endsAt: Date }>>;
  participant(
    roomId: string,
    participantIdentity: string,
    noticeVersion: string,
  ): Promise<SpeechParticipantContext | null>;
  recordRisk(input: {
    context: SpeechParticipantContext;
    classification: RiskClassification;
    correlationHash: string;
    occurredAt: Date;
    alertTtlSeconds: number;
    fencingToken: string;
  }): Promise<RoomSpeechAlert>;
  listHostAlerts(input: {
    roomId: string;
    actorUserId: string;
    cursor?: string;
    limit: number;
    now: Date;
  }): Promise<{ items: RoomSpeechAlert[]; nextCursor: string | null }>;
  openIncident(input: {
    roomId?: string;
    component: SafetyCapabilityComponent;
    errorCategory: string;
    providerCategory?: string;
    now: Date;
  }): Promise<SafetyCapabilityIncidentView>;
  recoverIncident(input: {
    roomId?: string;
    component: SafetyCapabilityComponent;
    errorCategory: string;
    now: Date;
  }): Promise<void>;
  listIncidents(input: {
    actorUserId: string;
    actorRoles: Array<'PLATFORM_ADMIN' | 'SAFETY_OFFICER' | 'OPERATIONS_ANALYST' | 'AUDITOR'>;
    requestId?: string;
    roomId?: string;
    component?: SafetyCapabilityComponent;
    status?: 'OPEN' | 'RECOVERED';
    from?: Date;
    to?: Date;
    cursor?: string;
    limit: number;
  }): Promise<{ items: SafetyCapabilityIncidentView[]; nextCursor: string | null }>;
  claimDeliveries(now?: Date): Promise<
    Array<{
      id: string;
      leaseId: string;
      roomId: string;
      alert: RoomSpeechAlert;
      expiresAt: Date;
    }>
  >;
  resolveDeliveryTarget(id: string, leaseId: string): Promise<string | null>;
  completeDelivery(id: string, leaseId: string, deliveredAt: Date): Promise<void>;
  failDelivery(id: string, leaseId: string, errorCategory: string, now: Date): Promise<void>;
  purge(before: Date): Promise<{ risks: number; incidents: number; deliveries: number }>;
}
