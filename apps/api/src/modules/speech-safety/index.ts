export { SpeechSafetyModule } from './speech-safety.module.js';
export { RoomSpeechSafetyService } from './application/services/room-speech-safety.service.js';
export { RoomSpeechRiskPolicy } from './domain/policies/room-speech-risk.policy.js';
export {
  ROOM_SPEECH_RISK_CATEGORIES,
  ROOM_SPEECH_RISK_SEVERITIES,
  SAFETY_CAPABILITY_COMPONENTS,
} from './domain/entities/room-speech-safety.js';
export type {
  RiskClassification,
  RoomSpeechAlert,
  SafetyCapabilityIncidentView,
  SpeechAudioWindow,
  SpeechParticipantContext,
} from './domain/entities/room-speech-safety.js';
export { ROOM_SPEECH_REPOSITORY } from './domain/ports/room-speech.repository.js';
export type { RoomSpeechRepository } from './domain/ports/room-speech.repository.js';
export { ROOM_SPEECH_COORDINATOR } from './domain/ports/room-speech-coordinator.port.js';
export type { RoomSpeechCoordinator } from './domain/ports/room-speech-coordinator.port.js';
export { ROOM_SPEECH_TRANSCRIBER } from './domain/ports/room-speech-transcriber.port.js';
export type {
  RoomSpeechTranscriber,
  RoomSpeechTranscriptionSession,
} from './domain/ports/room-speech-transcriber.port.js';
export { ROOM_MEDIA_SOURCE } from './domain/ports/room-media-source.port.js';
export type {
  RoomMediaFrame,
  RoomMediaSession,
  RoomMediaSource,
} from './domain/ports/room-media-source.port.js';
