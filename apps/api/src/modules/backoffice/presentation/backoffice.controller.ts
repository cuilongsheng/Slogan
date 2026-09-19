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
import { BackofficeAuditService, type BackofficeAuditEventView } from '../../audit/index.js';
import { BackofficeService } from '../application/services/backoffice.service.js';
import type { RoleAssignmentView } from '../domain/entities/backoffice.js';
import {
  BackofficePermissionGuard,
  type BackofficeRequest,
} from './backoffice-permission.guard.js';
import { RequireBackofficePermission } from './backoffice-permission.decorator.js';
import {
  AuditEventListDto,
  BackofficeMeDto,
  BackofficeRoleParamsDto,
  ListAuditEventsQueryDto,
  ListRoleAssignmentsQueryDto,
  RoleAssignmentDto,
  RoleAssignmentListDto,
  RoleMutationDto,
} from './dto/backoffice.dto.js';

const roleDto = (row: RoleAssignmentView): RoleAssignmentDto => ({
  ...row,
  grantedAt: row.grantedAt.toISOString(),
  revokedAt: row.revokedAt?.toISOString() ?? null,
});
const auditDto = (row: BackofficeAuditEventView) => ({
  ...row,
  occurredAt: row.occurredAt.toISOString(),
});

@ApiTags('backoffice')
@ApiBearerAuth()
@UseGuards(BackofficePermissionGuard)
@ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'ACCESS_TOKEN_INVALID' })
@ApiForbiddenResponse({ type: ErrorResponseDto, description: 'BACKOFFICE_ACCESS_DENIED' })
@Controller('backoffice')
export class BackofficeController {
  constructor(
    private readonly service: BackofficeService,
    private readonly auditsService: BackofficeAuditService,
  ) {}

  @Get('me')
  @RequireBackofficePermission('BACKOFFICE_ACCESS')
  @ApiOkResponse({ type: BackofficeMeDto })
  async me(@CurrentIdentity() identity: CurrentAccessIdentity): Promise<BackofficeMeDto> {
    return {
      userId: identity.userId,
      roles: await this.service.authorize(identity.userId, 'BACKOFFICE_ACCESS'),
    };
  }

  @Get('role-assignments')
  @RequireBackofficePermission('ROLE_ASSIGNMENTS_READ')
  @ApiOkResponse({ type: RoleAssignmentListDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({ type: ErrorResponseDto })
  async assignments(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Query() query: ListRoleAssignmentsQueryDto,
    @Req() request: BackofficeRequest,
  ): Promise<RoleAssignmentListDto> {
    const result = await this.service.listAssignments(
      identity.userId,
      { ...query, limit: query.limit ?? 20 },
      request.id,
    );
    return { items: result.items.map(roleDto), nextCursor: result.nextCursor };
  }

  @Post('users/:userId/roles/:role/grant')
  @HttpCode(HttpStatus.OK)
  @RequireBackofficePermission('ROLE_ASSIGNMENTS_MANAGE')
  @ApiOkResponse({ type: RoleAssignmentDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({ type: ErrorResponseDto })
  grant(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: BackofficeRoleParamsDto,
    @Body() body: RoleMutationDto,
    @Req() request: BackofficeRequest,
  ) {
    return this.mutate(identity.userId, params, body, 'GRANT', request.id);
  }

  @Post('users/:userId/roles/:role/revoke')
  @HttpCode(HttpStatus.OK)
  @RequireBackofficePermission('ROLE_ASSIGNMENTS_MANAGE')
  @ApiOkResponse({ type: RoleAssignmentDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({ type: ErrorResponseDto })
  revoke(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: BackofficeRoleParamsDto,
    @Body() body: RoleMutationDto,
    @Req() request: BackofficeRequest,
  ) {
    return this.mutate(identity.userId, params, body, 'REVOKE', request.id);
  }

  private async mutate(
    actorUserId: string,
    params: BackofficeRoleParamsDto,
    body: RoleMutationDto,
    action: 'GRANT' | 'REVOKE',
    requestId?: string,
  ) {
    return roleDto(
      await this.service.mutateRole({
        actorUserId,
        targetUserId: params.userId,
        role: params.role,
        action,
        ...body,
        ...(requestId ? { requestId } : {}),
      }),
    );
  }

  @Get('audit-events')
  @RequireBackofficePermission('AUDIT_EVENTS_READ')
  @ApiOkResponse({ type: AuditEventListDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({ type: ErrorResponseDto })
  async audits(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Query() query: ListAuditEventsQueryDto,
    @Req() request: BackofficeRequest,
  ): Promise<AuditEventListDto> {
    const result = await this.auditsService.list(
      identity.userId,
      request.backofficeRoles ?? [],
      {
        ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
        ...(query.action ? { action: query.action } : {}),
        ...(query.targetType ? { targetType: query.targetType } : {}),
        ...(query.targetId ? { targetId: query.targetId } : {}),
        ...(query.result ? { result: query.result } : {}),
        ...(query.cursor ? { cursor: query.cursor } : {}),
        ...(query.from ? { from: new Date(query.from) } : {}),
        ...(query.to ? { to: new Date(query.to) } : {}),
        limit: query.limit ?? 20,
      },
      request.id,
    );
    return { items: result.items.map(auditDto), nextCursor: result.nextCursor };
  }
}
