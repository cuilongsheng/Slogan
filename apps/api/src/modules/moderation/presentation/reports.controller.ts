import { Body, Controller, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  CurrentIdentity,
  type CurrentAccessIdentity,
} from '../../../common/decorators/current-identity.decorator.js';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto.js';
import { ReportsService } from '../application/services/reports.service.js';
import { ReportReceiptDto, ReportRoomParamsDto, SubmitReportDto } from './dto/report.dto.js';
@ApiTags('reports')
@ApiBearerAuth()
@Controller('rooms/:roomId/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}
  @Post()
  @ApiCreatedResponse({
    type: ReportReceiptDto,
    description: 'New submissions and equivalent retries both return the original minimal receipt.',
  })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'ACCESS_TOKEN_INVALID' })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'VALIDATION_FAILED or REPORT_TARGET_INVALID',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'REPORT_CONTEXT_NOT_FOUND for unknown room or missing historical membership',
  })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'REPORT_REQUEST_CONFLICT' })
  @ApiInternalServerErrorResponse({ type: ErrorResponseDto })
  async submit(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: ReportRoomParamsDto,
    @Body() input: SubmitReportDto,
  ): Promise<ReportReceiptDto> {
    const saved = await this.reports.submit({
      ...input,
      roomId: params.roomId,
      reporterUserId: identity.userId,
    });
    return { id: saved.id, caseId: saved.caseId, submittedAt: saved.submittedAt.toISOString() };
  }
}
