export const ROOM_SPEECH_RISK_CATEGORIES = [
  'HARASSMENT_ABUSE',
  'HATE_DISCRIMINATION',
  'SEXUAL_CONTENT',
  'THREAT_VIOLENCE',
  'SPAM_ADVERTISING',
  'OTHER_SAFETY_RISK',
] as const;
export type RoomSpeechRiskCategory = (typeof ROOM_SPEECH_RISK_CATEGORIES)[number];

export const ROOM_SPEECH_RISK_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type RoomSpeechRiskSeverity = (typeof ROOM_SPEECH_RISK_SEVERITIES)[number];

export const SAFETY_CAPABILITY_COMPONENTS = [
  'MEDIA_SUBSCRIPTION',
  'STREAMING_STT',
  'RISK_RULES',
  'COORDINATION',
  'HOST_ALERT_DELIVERY',
  'KEYWORD_CANDIDATE_EXTRACTION',
  'KEYWORD_CANDIDATE_STORE',
] as const;
export type SafetyCapabilityComponent = (typeof SAFETY_CAPABILITY_COMPONENTS)[number];

export interface RiskClassification {
  category: RoomSpeechRiskCategory;
  severity: RoomSpeechRiskSeverity;
  ruleSetVersion: string;
}

export interface SpeechParticipantContext {
  roomId: string;
  userId: string;
  participantIdentity: string;
  consentGeneration: string;
  roomEndsAt: Date;
}

export interface RoomSpeechAlert {
  id: string;
  roomId: string;
  subjectUserId: string;
  category: RoomSpeechRiskCategory;
  severity: RoomSpeechRiskSeverity;
  ruleSetVersion: string;
  firstOccurredAt: Date;
  lastOccurredAt: Date;
  occurrenceCount: number;
}

export interface SafetyCapabilityIncidentView {
  id: string;
  roomId: string | null;
  component: SafetyCapabilityComponent;
  errorCategory: string;
  providerCategory: string | null;
  status: 'OPEN' | 'RECOVERED';
  startedAt: Date;
  lastObservedAt: Date;
  recoveredAt: Date | null;
  affectedWindows: number;
}

export interface SpeechAudioWindow {
  roomId: string;
  participantIdentity: string;
  audio: Uint8Array;
  mimeType: string;
  sourceLanguageCode?: string;
  observedConsentGeneration?: string;
}
