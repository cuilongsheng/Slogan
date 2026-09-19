import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { RoomIdParamsDto } from './room.dto.js';
export class MemberActionParamsDto extends RoomIdParamsDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() membershipId!: string;
}
export class MemberGenerationDto {
  @ApiProperty({
    minimum: 0,
    description:
      'Observed credentialVersion. Retries of the same completed generation are idempotent; later generations return ROOM_OPERATION_CONFLICT.',
  })
  @IsInt()
  @Min(0)
  expectedCredentialVersion!: number;
}
export class LeaveRoomDto extends MemberGenerationDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Current host only; must reference an online ACTIVE member. Omit to select the earliest online member.',
  })
  @IsOptional()
  @IsUUID()
  successorMembershipId?: string;
}
export class HostActionResultDto {
  @ApiProperty({ format: 'uuid' }) roomId!: string;
  @ApiProperty({ enum: ['OPEN', 'ENDING', 'ENDED'] }) roomStatus!: string;
  @ApiProperty({ format: 'uuid' }) hostUserId!: string;
  @ApiProperty({ format: 'uuid' }) membershipId!: string;
  @ApiProperty({ enum: ['ACTIVE', 'LEFT', 'REMOVED', 'INVITED'] }) lifecycle!: string;
  @ApiProperty({ minimum: 0 }) credentialVersion!: number;
  @ApiProperty({
    enum: ['COMPLETED', 'PENDING', 'UNAVAILABLE'],
    description:
      'Database mutation is committed. PENDING means durable cleanup is outstanding; UNAVAILABLE means provider execution failed and remains recorded for recovery.',
  })
  providerStatus!: string;
}
