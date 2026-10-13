import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  CurrentIdentity,
  type CurrentAccessIdentity,
} from '../../../common/decorators/current-identity.decorator.js';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto.js';
import { ReportsService } from '../application/services/reports.service.js';
import { PersonalReportPageDto, PersonalReportQueryDto } from './dto/report-history.dto.js';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('me/reports')
export class PersonalReportsController {
  constructor(private readonly reports: ReportsService) {}
  @Get()
  @ApiOkResponse({ type: PersonalReportPageDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async list(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Query() query: PersonalReportQueryDto,
  ): Promise<PersonalReportPageDto> {
    const page = await this.reports.listOwn(identity.userId, query);
    return {
      items: page.items.map((item) => ({
        ...item,
        submittedAt: item.submittedAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        decidedAt: item.decidedAt?.toISOString() ?? null,
      })),
      nextCursor: page.nextCursor,
    };
  }
}
