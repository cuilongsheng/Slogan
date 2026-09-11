import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { CEFR_LEVELS, GENDER_CODES } from '../../domain/entities/profile.js';

export class PutProfileDto {
  @ApiProperty({ format: 'uri', maxLength: 2048 })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  avatarUrl!: string;

  @ApiProperty({ minLength: 2, maxLength: 40 })
  @IsString()
  @Length(2, 40)
  displayName!: string;

  @ApiProperty({ enum: GENDER_CODES })
  @IsIn(GENDER_CODES)
  genderCode!: (typeof GENDER_CODES)[number];

  @ApiPropertyOptional({ description: 'ISO 3166-1 alpha-2 code', example: 'CN' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/)
  nationalityCode?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiProperty({ type: [String], minItems: 1, maxItems: 10 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^[a-z0-9][a-z0-9_-]{0,39}$/, { each: true })
  interestCodes!: string[];

  @ApiProperty({ enum: CEFR_LEVELS })
  @IsIn(CEFR_LEVELS)
  cefrLevel!: (typeof CEFR_LEVELS)[number];

  @ApiProperty({ minimum: 1900, maximum: 2100 })
  @IsInt()
  @Min(1900)
  @Max(2100)
  birthYear!: number;

  @ApiProperty({ minimum: 1, maximum: 12 })
  @IsInt()
  @Min(1)
  @Max(12)
  birthMonth!: number;
}

export class ProfileDto extends PutProfileDto {
  @ApiProperty({ format: 'date-time' })
  completedAt!: string;
}

export class MeResponseDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ enum: ['PROFILE_REQUIRED', 'AGE_RESTRICTED', 'ELIGIBLE'] })
  onboardingState!: string;

  @ApiProperty({ type: ProfileDto, nullable: true })
  profile!: ProfileDto | null;
}
