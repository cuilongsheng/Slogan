import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Query,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiTooManyRequestsResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { IsString, IsIn, IsOptional, MaxLength, MinLength } from 'class-validator';
import type { Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator.js';
import {
  CurrentIdentity,
  type CurrentAccessIdentity,
} from '../../../common/decorators/current-identity.decorator.js';
import { AuthRateLimitGuard } from '../../../common/guards/auth-rate-limit.guard.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto.js';
import { AvatarService } from '../application/services/avatar.service.js';
export class AvatarUploadDto {
  @ApiProperty({ description: 'Base64 PNG bytes, without a data URL prefix', maxLength: 349528 })
  @IsString()
  @MinLength(1)
  @MaxLength(349528)
  imageBase64!: string;
}
export class DefaultAvatarQueryDto {
  @IsOptional()
  @IsIn(['male', 'female'])
  variant?: 'male' | 'female';
}
export class AvatarResponseDto {
  @ApiProperty({ format: 'uri' }) avatarUrl!: string;
}
@ApiTags('profiles')
@Controller()
export class AvatarController {
  constructor(private readonly avatars: AvatarService) {}
  @Post('me/avatar')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(AuthRateLimitGuard)
  @ApiBody({ type: AvatarUploadDto })
  @ApiOkResponse({ type: AvatarResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  @ApiServiceUnavailableResponse({ type: ErrorResponseDto })
  async upload(@CurrentIdentity() identity: CurrentAccessIdentity, @Body() body: AvatarUploadDto) {
    return this.avatars.replace(identity.userId, body.imageBase64);
  }
  @Public()
  @Get('avatars/default')
  @ApiQuery({ name: 'variant', required: false, enum: ['male', 'female'] })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiOkResponse({ content: { 'image/png': { schema: { type: 'string', format: 'binary' } } } })
  default(@Query() query: DefaultAvatarQueryDto, @Res() response: Response) {
    response
      .set({
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      })
      .send(Buffer.from(this.avatars.defaultImage(query.variant)));
  }
  @Public()
  @Get('avatars/:id')
  @ApiOkResponse({ content: { 'image/png': { schema: { type: 'string', format: 'binary' } } } })
  async image(@Param('id', ParseUUIDPipe) id: string, @Res() response: Response) {
    const image = await this.avatars.find(id);
    if (!image) throw new AppError('AVATAR_NOT_FOUND', 'Profile image was not found', 404);
    response
      .set({
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=300',
        ETag: `"${image.sha256}"`,
        'X-Content-Type-Options': 'nosniff',
      })
      .send(Buffer.from(image.image));
  }
}
