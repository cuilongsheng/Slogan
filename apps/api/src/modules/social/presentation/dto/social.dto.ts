import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class SocialCommandDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  clientRequestId!: string;
}

export class SocialTargetCommandDto extends SocialCommandDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  targetUserId!: string;
}

export class SocialCommandQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  clientRequestId!: string;
}

export class SocialPageQueryDto {
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

export class FriendRequestPageQueryDto extends SocialPageQueryDto {
  @ApiProperty({ enum: ['incoming', 'outgoing'] })
  @IsIn(['incoming', 'outgoing'])
  direction!: 'incoming' | 'outgoing';
}

export class FriendRequestParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  requestId!: string;
}

export class SocialUserParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId!: string;
}

export class FriendRequestDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) requesterUserId!: string;
  @ApiProperty({ format: 'uuid' }) recipientUserId!: string;
  @ApiProperty({ enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'BLOCKED'] })
  status!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) resolvedAt!: string | null;
}

export class FriendRequestListDto extends FriendRequestDto {
  @ApiProperty({ type: String, nullable: true }) peerDisplayName!: string | null;
}

export class PublicSocialProfileDto {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ format: 'uri' }) avatarUrl!: string;
  @ApiProperty({ enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] }) cefrLevel!: string;
  @ApiProperty({ type: String, nullable: true }) nationalityCode!: string | null;
  @ApiProperty({ type: String, nullable: true }) city!: string | null;
  @ApiProperty({ type: [String] }) interestCodes!: string[];
}

export class FriendDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: PublicSocialProfileDto }) friend!: PublicSocialProfileDto;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty() isAvailable!: boolean;
}

export class AvailableUserDto extends PublicSocialProfileDto {
  @ApiProperty() isAvailable!: boolean;
}

export class BlockDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) blockedUserId!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class FriendRequestPageDto {
  @ApiProperty({ type: [FriendRequestListDto] }) items!: FriendRequestListDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
export class FriendPageDto {
  @ApiProperty({ type: [FriendDto] }) items!: FriendDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
export class BlockPageDto {
  @ApiProperty({ type: [BlockDto] }) items!: BlockDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
export class AvailableUserPageDto {
  @ApiProperty({ type: [AvailableUserDto] }) items!: AvailableUserDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
export class PresenceDto {
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
  @ApiProperty({ minimum: 1 }) refreshAfterSeconds!: number;
}

export class PresenceHeartbeatDto {}

export class RelationshipEndDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'date-time' }) endedAt!: string;
}
