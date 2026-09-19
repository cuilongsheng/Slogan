import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';

import { OAuthExchangeDto } from './auth.dto.js';

export class PhoneChallengeDto {
  @ApiProperty({ example: '+8613812345678', minLength: 7, maxLength: 32 })
  @IsString()
  @Length(7, 32)
  phone!: string;

  @ApiPropertyOptional({ example: 'CN', minLength: 2, maxLength: 2 })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  defaultRegion?: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @Length(8, 128)
  deviceId!: string;

  @ApiPropertyOptional({ example: 'zh-CN', maxLength: 16 })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  locale?: string;
}

export class PhoneChallengeResponseDto {
  @ApiProperty({ format: 'uuid' })
  challengeId!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ format: 'date-time' })
  resendAt!: string;
}

export class PhoneExchangeDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  challengeId!: string;

  @ApiProperty({ pattern: '^\\d{6}$' })
  @Matches(/^\d{6}$/)
  code!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  clientRequestId!: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceName?: string;
}

export class PhoneConfirmDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  challengeId!: string;

  @ApiProperty({ pattern: '^\\d{6}$' })
  @Matches(/^\d{6}$/)
  code!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  clientRequestId!: string;
}

export class OAuthLinkDto extends OAuthExchangeDto {}

export class OAuthDeleteProofDto extends OAuthExchangeDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  clientRequestId!: string;
}

export class LoginMethodDto {
  @ApiProperty({ enum: ['PHONE', 'GOOGLE', 'WECHAT'] })
  type!: string;

  @ApiProperty({ format: 'date-time' })
  verifiedAt!: string;

  @ApiPropertyOptional({ example: '+86••78' })
  mask?: string;
}

export class LoginMethodsResponseDto {
  @ApiProperty({ type: [LoginMethodDto] })
  methods!: LoginMethodDto[];
}

export class LinkResultDto {
  @ApiProperty({ enum: ['CREATED', 'ALREADY_LINKED'] })
  result!: string;
}

export class StepUpProofDto {
  @ApiProperty({ minLength: 36, maxLength: 64 })
  proof!: string;
}

export class AccountDeleteProviderParamsDto {
  @ApiProperty({ enum: ['google', 'wechat'] })
  @IsIn(['google', 'wechat'])
  provider!: 'google' | 'wechat';
}
