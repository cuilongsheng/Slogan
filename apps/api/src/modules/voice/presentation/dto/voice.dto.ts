import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CEFR_LEVELS } from '../../../profiles/index.js';
export class RealtimeCredentialDto {
  @ApiProperty({ enum: ['ACTIVE'] }) lifecycle!: string;
  @ApiProperty({ enum: ['HOST', 'MEMBER'] }) role!: string;
  @ApiProperty({ minimum: 0 }) credentialVersion!: number;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) hostReconnectDeadline!:
    string | null;
  @ApiProperty({ format: 'uuid' }) roomId!: string;
  @ApiProperty({ example: 'wss://project.livekit.cloud' }) serverUrl!: string;
  @ApiProperty({ description: 'Short-lived microphone-only participant JWT; never log this value' })
  participantToken!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
  @ApiProperty({ format: 'uuid' }) participantIdentity!: string;
}
export class RealtimeMemberDto {
  @ApiProperty({ enum: ['ACTIVE'] }) lifecycle!: string;
  @ApiProperty({ minimum: 0 }) credentialVersion!: number;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) hostReconnectDeadline!:
    string | null;
  @ApiProperty({ format: 'uuid' }) membershipId!: string;
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() displayName!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) avatarUrl?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) nationalityCode?: string | null;
  @ApiProperty({ enum: CEFR_LEVELS }) cefrLevel!: string;
  @ApiProperty({ enum: ['HOST', 'MEMBER'] }) role!: string;
  @ApiProperty({ minimum: 1 }) position!: number;
  @ApiProperty({ enum: ['CONNECTED', 'DISCONNECTED'] }) presence!: string;
  @ApiProperty({ format: 'uuid' }) participantIdentity!: string;
}

export class RemovedRoomMemberDto {
  @ApiProperty({ format: 'uuid' }) membershipId!: string;
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ enum: CEFR_LEVELS }) cefrLevel!: string;
  @ApiProperty({ minimum: 0 }) credentialVersion!: number;
}
