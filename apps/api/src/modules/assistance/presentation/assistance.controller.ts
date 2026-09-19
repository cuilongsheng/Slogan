import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiGoneResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import {
  CurrentIdentity,
  type CurrentAccessIdentity,
} from '../../../common/decorators/current-identity.decorator.js';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto.js';
import { AssistanceError } from '../domain/errors/assistance.error.js';
import { AssistanceService } from '../application/services/assistance.service.js';
import {
  AssistanceRoomParamsDto,
  AudioExpressionRequestDto,
  ConsentCommandDto,
  ConsentStateDto,
  ConsentStatePageDto,
  ExpressionResultDto,
  TextExpressionRequestDto,
} from './dto/assistance.dto.js';

interface UploadedAudio {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@ApiTags('expression-assistance')
@ApiBearerAuth()
@ApiBadRequestResponse({ type: ErrorResponseDto })
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@ApiForbiddenResponse({ type: ErrorResponseDto })
@ApiConflictResponse({ type: ErrorResponseDto })
@ApiGoneResponse({ type: ErrorResponseDto })
@ApiTooManyRequestsResponse({ type: ErrorResponseDto })
@ApiServiceUnavailableResponse({ type: ErrorResponseDto })
@Controller()
export class AssistanceController {
  constructor(private readonly assistance: AssistanceService) {}

  @Post('rooms/:roomId/expression-assistance/text')
  @HttpCode(200)
  @ApiOkResponse({ type: ExpressionResultDto })
  async text(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: AssistanceRoomParamsDto,
    @Body() body: TextExpressionRequestDto,
  ) {
    return this.result(await this.assistance.text(identity.userId, params.roomId, body));
  }

  @Post('rooms/:roomId/expression-assistance/audio')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['clientRequestId', 'noticeVersion', 'noticeConfirmed', 'audio'],
      properties: {
        clientRequestId: { type: 'string', format: 'uuid' },
        noticeVersion: { type: 'string', maxLength: 64 },
        noticeConfirmed: { type: 'boolean' },
        sourceLanguageCode: { type: 'string' },
        audio: {
          type: 'string',
          format: 'binary',
          description: 'One supported audio file, maximum 5 MiB and 30 seconds.',
        },
      },
    },
  })
  @ApiOkResponse({ type: ExpressionResultDto })
  async audio(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: AssistanceRoomParamsDto,
    @Body() body: AudioExpressionRequestDto,
    @UploadedFile() file?: UploadedAudio,
  ) {
    if (!file?.buffer?.length)
      throw new AssistanceError('ASSISTANCE_AUDIO_INVALID', 'Audio input is required');
    return this.result(
      await this.assistance.audio(identity.userId, params.roomId, {
        ...body,
        audio: file.buffer,
        mimeType: file.mimetype,
      }),
    );
  }

  @Get('me/speech-processing-consents')
  @ApiOkResponse({ type: ConsentStatePageDto })
  async consentState(@CurrentIdentity() identity: CurrentAccessIdentity) {
    return {
      items: [
        this.consent(await this.assistance.consentState(identity.userId)),
        this.consent(await this.assistance.roomConsentState(identity.userId)),
        this.consent(await this.assistance.postRoomKeywordsConsentState(identity.userId)),
      ],
    };
  }

  @Put('me/speech-processing-consents/post-room-keywords')
  @ApiOkResponse({ type: ConsentStateDto })
  async postRoomKeywordsConsentCommand(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Body() body: ConsentCommandDto,
  ) {
    return this.consent(await this.assistance.changePostRoomKeywordsConsent(identity.userId, body));
  }

  @Put('me/speech-processing-consents/room-safety')
  @ApiOkResponse({ type: ConsentStateDto })
  async roomConsentCommand(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Body() body: ConsentCommandDto,
  ) {
    return this.consent(await this.assistance.changeRoomConsent(identity.userId, body));
  }

  @Put('me/speech-processing-consents/ai-expression')
  @ApiOkResponse({ type: ConsentStateDto })
  async consentCommand(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Body() body: ConsentCommandDto,
  ) {
    return this.consent(await this.assistance.changeConsent(identity.userId, body));
  }

  private result(value: Awaited<ReturnType<AssistanceService['text']>>) {
    return {
      ...value,
      generatedAt: value.generatedAt.toISOString(),
      expiresAt: value.expiresAt.toISOString(),
    };
  }

  private consent(value: Awaited<ReturnType<AssistanceService['consentState']>>) {
    return { ...value, changedAt: value.changedAt?.toISOString() ?? null };
  }
}
