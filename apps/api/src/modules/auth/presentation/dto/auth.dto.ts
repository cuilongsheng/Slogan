import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export const OAUTH_PROVIDER_PARAMS = ['google', 'wechat'] as const;
export type OAuthProviderParam = (typeof OAUTH_PROVIDER_PARAMS)[number];

export class OAuthExchangeDto {
  @ApiProperty({ minLength: 1, maxLength: 4096 })
  @IsString()
  @Length(1, 4096)
  authorizationCode!: string;

  @ApiProperty({ example: 'slogan://oauth/google' })
  @IsString()
  @MaxLength(2048)
  @Matches(/^[a-z][a-z0-9+.-]*:\/\//i)
  redirectUri!: string;

  @ApiPropertyOptional({ minLength: 43, maxLength: 128 })
  @IsOptional()
  @IsString()
  @Length(43, 128)
  codeVerifier?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceName?: string;
}

export class RefreshTokenDto {
  @ApiProperty({ minLength: 40, maxLength: 200 })
  @IsString()
  @Length(40, 200)
  refreshToken!: string;
}

export class TokenPairDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ example: 900 })
  accessTokenExpiresInSeconds!: number;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ format: 'date-time' })
  refreshTokenExpiresAt!: string;
}

export class BrowserTokenDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ example: 900 })
  accessTokenExpiresInSeconds!: number;
}

export class SuggestedProfileDto {
  @ApiPropertyOptional()
  displayName?: string;

  @ApiPropertyOptional()
  avatarUrl?: string;
}

export class BrowserOAuthExchangeResponseDto extends BrowserTokenDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty()
  created!: boolean;

  @ApiProperty({ enum: ['PROFILE_REQUIRED', 'AGE_RESTRICTED', 'ELIGIBLE'] })
  onboardingState!: string;

  @ApiPropertyOptional({ type: SuggestedProfileDto })
  suggestedProfile?: SuggestedProfileDto;
}

export class OAuthExchangeResponseDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty()
  created!: boolean;

  @ApiProperty({ enum: ['PROFILE_REQUIRED', 'AGE_RESTRICTED', 'ELIGIBLE'] })
  onboardingState!: string;

  @ApiProperty({ type: TokenPairDto })
  tokens!: TokenPairDto;

  @ApiPropertyOptional({ type: SuggestedProfileDto })
  suggestedProfile?: SuggestedProfileDto;
}

export class OAuthProviderParamsDto {
  @ApiProperty({ enum: OAUTH_PROVIDER_PARAMS })
  @IsIn(OAUTH_PROVIDER_PARAMS)
  provider!: OAuthProviderParam;
}
