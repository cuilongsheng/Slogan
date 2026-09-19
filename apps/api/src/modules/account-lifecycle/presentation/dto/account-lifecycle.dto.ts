import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';

export class DeleteAccountDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
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

  @ApiProperty({ enum: ['PHONE', 'GOOGLE', 'WECHAT'], isArray: true })
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
