import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateRoomInvitationDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() targetUserId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() clientRequestId!: string;
}

export class DeclineRoomInvitationDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() clientRequestId!: string;
}

export class RoomInvitationParamsDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() invitationId!: string;
}

export class RoomInvitationPageQueryDto {
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

export class RoomInvitationDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) roomId!: string;
  @ApiProperty({ format: 'uuid' }) inviterUserId!: string;
  @ApiProperty({ format: 'uuid' }) inviteeUserId!: string;
  @ApiProperty({ enum: ['PENDING', 'DECLINED', 'CONSUMED', 'CANCELLED'] }) status!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) resolvedAt!: string | null;
}

export class RoomInvitationViewDto extends RoomInvitationDto {
  @ApiProperty() inviterDisplayName!: string;
  @ApiProperty({
    type: 'object',
    properties: {
      topic: { type: 'string' },
      cefrLevel: { type: 'string' },
      status: { type: 'string' },
      startedAt: { type: 'string', format: 'date-time' },
      endsAt: { type: 'string', format: 'date-time' },
      passwordProtected: { type: 'boolean' },
    },
  })
  room!: Record<string, unknown>;
}

export class RoomInvitationPageDto {
  @ApiProperty({ type: [RoomInvitationViewDto] }) items!: RoomInvitationViewDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
