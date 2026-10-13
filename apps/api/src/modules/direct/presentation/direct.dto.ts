import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DirectPageQueryDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cursor?: string;
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
export class OpenConversationDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() targetUserId!: string;
}
export class ConversationParamsDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() conversationId!: string;
}
export class DirectCallParamsDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() callId!: string;
}
export class DirectReportParamsDto extends ConversationParamsDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() messageId!: string;
}
export class DirectCommandDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() clientRequestId!: string;
}
export class SendDirectMessageDto extends DirectCommandDto {
  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text!: string;
}
export class DirectReadDto {
  @ApiProperty({ minimum: 0, maximum: 2147483646 })
  @IsInt()
  @Min(0)
  @Max(2147483646)
  sequence!: number;
}
export class DirectReportDto extends DirectCommandDto {
  @ApiProperty({
    enum: [
      'HARASSMENT_ABUSE',
      'HATE_DISCRIMINATION',
      'SEXUAL_CONTENT',
      'SPAM_ADVERTISING',
      'OTHER',
    ],
  })
  @IsIn(['HARASSMENT_ABUSE', 'HATE_DISCRIMINATION', 'SEXUAL_CONTENT', 'SPAM_ADVERTISING', 'OTHER'])
  category!: string;
  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description!: string;
}
export class DirectPeerDto {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ format: 'uri' }) avatarUrl!: string;
  @ApiProperty({ enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'A1_A2', 'B1_B2', 'C1_C2'] })
  cefrLevel!: string;
}
export class DirectMessageDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) conversationId!: string;
  @ApiProperty({ format: 'uuid' }) senderUserId!: string;
  @ApiProperty({ format: 'uuid' }) clientRequestId!: string;
  @ApiProperty() sequence!: number;
  @ApiProperty() text!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
export class DirectConversationDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: DirectPeerDto }) peer!: DirectPeerDto;
  @ApiProperty({ type: DirectMessageDto, nullable: true }) lastMessage!: DirectMessageDto | null;
  @ApiProperty({ type: () => DirectCallDto, nullable: true }) lastCall!: DirectCallDto | null;
  @ApiProperty() unreadCount!: number;
  @ApiProperty({ format: 'date-time' }) lastActivityAt!: string;
  @ApiProperty() canInteract!: boolean;
}
export class DirectUnreadDto {
  @ApiProperty({ minimum: 0, type: 'integer' }) unreadCount!: number;
}
export class DirectConversationPageDto {
  @ApiProperty({ type: [DirectConversationDto] }) items!: DirectConversationDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
export class DirectMessagePageDto {
  @ApiProperty() visibleAfterSequence!: number;
  @ApiProperty({ type: [DirectMessageDto] }) items!: DirectMessageDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
export class DirectCallDto {
  @ApiProperty() sequence!: number;
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) conversationId!: string;
  @ApiProperty({ format: 'uuid' }) callerUserId!: string;
  @ApiProperty({ format: 'uuid' }) calleeUserId!: string;
  @ApiProperty({ enum: ['RINGING', 'ACTIVE', 'REJECTED', 'EXPIRED', 'ENDED'] }) status!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) acceptedAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) endedAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) endReason!: string | null;
  @ApiPropertyOptional({ type: DirectPeerDto }) peer?: DirectPeerDto;
}
export class DirectCallPageDto {
  @ApiProperty({ type: [DirectCallDto] }) items!: DirectCallDto[];
}
export class DirectCallHistoryPageDto extends DirectCallPageDto {
  @ApiProperty() visibleAfterSequence!: number;
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
export class DirectCredentialsDto {
  @ApiProperty({ format: 'uri' }) url!: string;
  @ApiProperty() token!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
  @ApiProperty() identity!: string;
  @ApiProperty() roomName!: string;
}
