import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { Environment } from '../../../config/environment.js';
import { Public } from '../../../common/decorators/public.decorator.js';

export class AuthCapabilitiesDto {
  @ApiProperty() password!: boolean;
  @ApiProperty() google!: boolean;
  @ApiProperty() email!: boolean;
}
@ApiTags('auth')
@Controller('auth')
export class AuthCapabilitiesController {
  constructor(private readonly config: ConfigService<Environment, true>) {}
  @Public()
  @Get('capabilities')
  @ApiOkResponse({ type: AuthCapabilitiesDto })
  capabilities(): AuthCapabilitiesDto {
    return {
      password: this.config.get('EMAIL_PASSWORD_AUTH_ENABLED', { infer: true }),
      google: this.config.get('GOOGLE_OAUTH_ENABLED', { infer: true }),
      email:
        this.config.get('EMAIL_AUTH_MAIL_ENABLED', { infer: true }) ??
        this.config.get('EMAIL_PASSWORD_AUTH_ENABLED', { infer: true }),
    };
  }
}
