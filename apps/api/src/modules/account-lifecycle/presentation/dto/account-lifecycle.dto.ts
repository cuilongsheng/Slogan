import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsUUID, Matches } from 'class-validator';

export class DeleteAccountDto {
  @ApiProperty({ description: 'Existing UUID proof or email password proof', maxLength: 64 })
  @Matches(
    /^(?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|email:[A-Za-z0-9_-]{43})$/,
  )
  proof!: string;

  @ApiProperty({ enum: ['DELETE MY ACCOUNT'] })
  @IsIn(['DELETE MY ACCOUNT'])
  confirmation!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  clientRequestId!: string;
}

export class AccountDeletionResponseDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ enum: ['DELETED'] })
  status!: 'DELETED';

  @ApiProperty({ format: 'date-time' })
  deletedAt!: string;
}

export class RestrictedAccountParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId!: string;
}

export class RestrictedProfileDto {
  @ApiProperty()
  displayName!: string;

  @ApiProperty()
  avatarUrl!: string;

  @ApiPropertyOptional({ nullable: true })
  nationalityCode!: string | null;

  @ApiProperty()
  cefrLevel!: string;
}

export class RestrictedAccountRecordDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ enum: ['DELETED'] })
  status!: 'DELETED';

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  deletedAt!: string;

  @ApiProperty({ enum: ['PHONE', 'GOOGLE', 'WECHAT', 'EMAIL_PASSWORD'], isArray: true })
  loginMethods!: string[];

  @ApiPropertyOptional({ type: RestrictedProfileDto, nullable: true })
  profile!: RestrictedProfileDto | null;

  @ApiProperty({ type: [String], format: 'uuid' })
  safetyCaseIds!: string[];

  @ApiProperty({ type: [String], format: 'uuid' })
  restrictionIds!: string[];

  @ApiProperty({ type: [String], format: 'uuid' })
  appealIds!: string[];
}
