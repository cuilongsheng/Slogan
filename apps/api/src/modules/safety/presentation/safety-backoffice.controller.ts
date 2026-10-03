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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
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
import {
  BackofficePermissionGuard,
  RequireBackofficePermission,
  type BackofficeRole,
} from '../../backoffice/index.js';
import { SafetyService } from '../application/services/safety.service.js';
import {
  DecideSafetyAppealDto,
  ResolveSafetyCaseDto,
  SafetyAppealDto,
  SafetyAppealListDto,
  SafetyAppealListQueryDto,
  SafetyAppealParamsDto,
  SafetyAppealSummaryDto,
  SafetyCaseDto,
  SafetyCaseListDto,
  SafetyCaseListQueryDto,
  SafetyCaseParamsDto,
  SafetyCaseSummaryDto,
  SafetyCommandDto,
  SafetyEvidenceDto,
  SafetyReasonCommandDto,
  SafetyResolveResultDto,
  SafetyRestrictionDto,
  SafetyRestrictionListDto,
  SafetyRestrictionListQueryDto,
  SafetyRestrictionParamsDto,
} from './dto/safety.dto.js';

type SafetyRequest = { id?: string; backofficeRoles?: BackofficeRole[] };

@ApiTags('backoffice-safety')
@ApiBearerAuth()
@UseGuards(BackofficePermissionGuard)
@RequireBackofficePermission('BACKOFFICE_ACCESS')
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@ApiForbiddenResponse({ type: ErrorResponseDto })
@ApiBadRequestResponse({ type: ErrorResponseDto })
@ApiNotFoundResponse({ type: ErrorResponseDto })
@ApiConflictResponse({ type: ErrorResponseDto })
@ApiInternalServerErrorResponse({ type: ErrorResponseDto })
@Controller('backoffice/safety')
export class SafetyBackofficeController {
  constructor(private readonly safety: SafetyService) {}
  private actor(identity: CurrentAccessIdentity, request: SafetyRequest) {
    return {
      userId: identity.userId,
      roles: request.backofficeRoles ?? [],
      ...(request.id ? { requestId: request.id } : {}),
    };
  }
  @Get('cases')
  @ApiOkResponse({ type: SafetyCaseListDto })
  listCases(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Query() query: SafetyCaseListQueryDto,
    @Req() request: SafetyRequest,
  ) {
    return this.safety.listCases(this.actor(identity, request), {
      ...(query.status ? { status: query.status } : {}),
      ...(query.targetUserId ? { targetUserId: query.targetUserId } : {}),
      ...(query.from ? { from: new Date(query.from) } : {}),
      ...(query.to ? { to: new Date(query.to) } : {}),
      ...(query.cursor ? { cursor: query.cursor } : {}),
      limit: query.limit ?? 20,
    });
  }
  @Get('cases/summary')
  @ApiOkResponse({ type: SafetyCaseSummaryDto })
  caseSummary(@CurrentIdentity() identity: CurrentAccessIdentity, @Req() request: SafetyRequest) {
    return this.safety.caseSummary(this.actor(identity, request));
  }
  @Get('cases/:caseId')
  @ApiOkResponse({ type: SafetyCaseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  detail(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: SafetyCaseParamsDto,
    @Req() request: SafetyRequest,
  ) {
    return this.safety.detail(this.actor(identity, request), params.caseId);
  }
  @Get('cases/:caseId/evidence')
  @ApiOkResponse({ type: SafetyEvidenceDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  evidence(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: SafetyCaseParamsDto,
    @Req() request: SafetyRequest,
  ) {
    return this.safety.evidence(this.actor(identity, request), params.caseId);
  }
  @Post('cases/:caseId/claim')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SafetyCaseDto })
  claim(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: SafetyCaseParamsDto,
    @Body() body: SafetyCommandDto,
    @Req() request: SafetyRequest,
  ) {
    return this.safety.claim(this.actor(identity, request), params.caseId, body.clientRequestId);
  }
  @Post('cases/:caseId/start')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SafetyCaseDto })
  start(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: SafetyCaseParamsDto,
    @Body() body: SafetyCommandDto,
    @Req() request: SafetyRequest,
  ) {
    return this.safety.start(this.actor(identity, request), params.caseId, body.clientRequestId);
  }
  @Post('cases/:caseId/dismiss')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SafetyCaseDto })
  dismiss(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: SafetyCaseParamsDto,
    @Body() body: SafetyReasonCommandDto,
    @Req() request: SafetyRequest,
  ) {
    return this.safety.dismiss(
      this.actor(identity, request),
      params.caseId,
      body.clientRequestId,
      body.reason,
    );
  }
  @Post('cases/:caseId/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SafetyResolveResultDto })
  resolve(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: SafetyCaseParamsDto,
    @Body() body: ResolveSafetyCaseDto,
    @Req() request: SafetyRequest,
  ) {
    return this.safety.resolve({
      actor: this.actor(identity, request),
      caseId: params.caseId,
      ...body,
    });
  }
  @Get('restrictions')
  @ApiOkResponse({ type: SafetyRestrictionListDto })
  restrictions(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Query() query: SafetyRestrictionListQueryDto,
    @Req() request: SafetyRequest,
  ) {
    return this.safety.listRestrictions(this.actor(identity, request), {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.cursor ? { cursor: query.cursor } : {}),
      limit: query.limit ?? 20,
    });
  }
  @Post('restrictions/:restrictionId/lift')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SafetyRestrictionDto })
  lift(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: SafetyRestrictionParamsDto,
    @Body() body: SafetyReasonCommandDto,
    @Req() request: SafetyRequest,
  ) {
    return this.safety.lift(this.actor(identity, request), params.restrictionId, body);
  }
  @Get('appeals')
  @ApiOkResponse({ type: SafetyAppealListDto })
  appeals(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Query() query: SafetyAppealListQueryDto,
    @Req() request: SafetyRequest,
  ) {
    return this.safety.listAppeals(this.actor(identity, request), {
      ...(query.status ? { status: query.status } : {}),
      ...(query.cursor ? { cursor: query.cursor } : {}),
      limit: query.limit ?? 20,
    });
  }
  @Get('appeals/summary')
  @ApiOkResponse({ type: SafetyAppealSummaryDto })
  appealSummary(@CurrentIdentity() identity: CurrentAccessIdentity, @Req() request: SafetyRequest) {
    return this.safety.appealSummary(this.actor(identity, request));
  }
  @Post('appeals/:appealId/decide')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SafetyAppealDto })
  decide(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: SafetyAppealParamsDto,
    @Body() body: DecideSafetyAppealDto,
    @Req() request: SafetyRequest,
  ) {
    return this.safety.decideAppeal(this.actor(identity, request), params.appealId, body);
  }
}
