import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  CurrentIdentity,
  type CurrentAccessIdentity,
} from '../../../common/decorators/current-identity.decorator.js';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto.js';
import { SafetyService } from '../application/services/safety.service.js';
import {
  OwnSafetyRestrictionListDto,
  PageQueryDto,
  SafetyAppealDto,
  SafetyRestrictionParamsDto,
  SubmitSafetyAppealDto,
} from './dto/safety.dto.js';

@ApiTags('me-safety')
@ApiBearerAuth()
@Controller('me/safety-restrictions')
export class MeSafetyController {
  constructor(private readonly safety: SafetyService) {}
  @Get()
  @ApiOkResponse({ type: OwnSafetyRestrictionListDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  list(@CurrentIdentity() identity: CurrentAccessIdentity, @Query() query: PageQueryDto) {
    return this.safety.ownRestrictions(identity.userId, {
      ...(query.cursor ? { cursor: query.cursor } : {}),
      limit: query.limit ?? 20,
    });
  }
  @Post(':restrictionId/appeal')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SafetyAppealDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  appeal(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: SafetyRestrictionParamsDto,
    @Body() body: SubmitSafetyAppealDto,
    @Req() request: { id?: string },
  ) {
    return this.safety.appeal(identity.userId, params.restrictionId, body, request.id);
  }
}
