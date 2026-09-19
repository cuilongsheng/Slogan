import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentIdentity, type CurrentAccessIdentity } from '../../../common/decorators/current-identity.decorator.js';
import { BackofficePermissionGuard, type BackofficeRequest, RequireBackofficePermission } from '../../backoffice/index.js';
import { GovernanceService } from '../application/services/governance.service.js';
import { IncidentsService } from '../application/services/incidents.service.js';
import { MetricsService } from '../application/services/metrics.service.js';
import { CreateHoldDto, CreatePolicyDto, CreateRunDto, DryRunDto, GenerateMetricDto, IdParamsDto, IncidentCommandDto, IncidentQueryDto, MetricsQueryDto, OperationsPageQueryDto, ReasonDto, RecoveryDrillDto, TimeRangeQueryDto } from './dto/operations.dto.js';

@ApiTags('backoffice-operations')
@ApiBearerAuth()
@UseGuards(BackofficePermissionGuard)
@Controller('backoffice')
export class OperationsController {
  constructor(private readonly metrics: MetricsService, private readonly incidents: IncidentsService, private readonly governance: GovernanceService) {}
  private roles(request: BackofficeRequest) { return request.backofficeRoles ?? []; }

  @Get('operations/metrics') @RequireBackofficePermission('OPERATIONS_METRICS_READ') @ApiOkResponse({ description: 'Anonymous aggregate metric snapshots; small samples are suppressed.' })
  metricsList(@CurrentIdentity() actor: CurrentAccessIdentity, @Query() query: MetricsQueryDto, @Req() request: BackofficeRequest) {
    return this.metrics.list(actor.userId, this.roles(request), { from: new Date(query.from), to: new Date(query.to), limit: query.limit ?? 20, ...(query.cursor ? { cursor: query.cursor } : {}), ...(query.grain ? { grain: query.grain } : {}), ...(query.metricKey ? { metricKey: query.metricKey } : {}), ...(query.dimension ? { dimension: query.dimension } : {}) }, request.id);
  }
  @Post('operations/metrics/generate') @HttpCode(200) @RequireBackofficePermission('DATA_GOVERNANCE_MANAGE')
  generate(@Body() body: GenerateMetricDto) { return this.metrics.generate(body.grain, new Date(body.windowInstant)); }
  @Get('operations/online') @RequireBackofficePermission('OPERATIONS_METRICS_READ') online() { return this.metrics.online(); }
  @Get('operations/rooms') @RequireBackofficePermission('OPERATIONS_DETAILS_READ')
  rooms(@CurrentIdentity() actor: CurrentAccessIdentity, @Query() query: OperationsPageQueryDto, @Req() request: BackofficeRequest) { return this.metrics.rooms(actor.userId, this.roles(request), query.cursor, query.limit ?? 20, request.id); }
  @Get('operations/active-users') @RequireBackofficePermission('OPERATIONS_DETAILS_READ')
  active(@CurrentIdentity() actor: CurrentAccessIdentity, @Query() query: TimeRangeQueryDto, @Req() request: BackofficeRequest) { return this.metrics.activeUsers(actor.userId, this.roles(request), new Date(query.from), new Date(query.to), query.cursor, query.limit ?? 20, request.id); }
  @Get('operations/health') @RequireBackofficePermission('OPERATIONS_HEALTH_READ') health() { return this.governance.health(); }

  @Get('incidents') @RequireBackofficePermission('OPERATIONAL_INCIDENTS_READ')
  incidentList(@CurrentIdentity() actor: CurrentAccessIdentity, @Query() query: IncidentQueryDto, @Req() request: BackofficeRequest) { return this.incidents.list(actor.userId, this.roles(request), { limit: query.limit ?? 20, ...(query.cursor ? { cursor: query.cursor } : {}), ...(query.status ? { status: query.status } : {}), ...(query.severity ? { severity: query.severity } : {}), ...(query.component ? { component: query.component } : {}), ...(query.from ? { from: new Date(query.from) } : {}), ...(query.to ? { to: new Date(query.to) } : {}) }, request.id); }
  @Get('incidents/trends') @RequireBackofficePermission('OPERATIONS_HEALTH_READ')
  trends(@Query() query: TimeRangeQueryDto) { return this.incidents.trends(new Date(query.from), new Date(query.to)); }
  @Get('incidents/:id') @RequireBackofficePermission('OPERATIONAL_INCIDENTS_READ')
  incident(@CurrentIdentity() actor: CurrentAccessIdentity, @Param() params: IdParamsDto, @Req() request: BackofficeRequest) { return this.incidents.detail(actor.userId, this.roles(request), params.id, request.id); }
  @Post('incidents/:id/acknowledge') @HttpCode(200) @RequireBackofficePermission('OPERATIONAL_INCIDENTS_MANAGE')
  acknowledge(@CurrentIdentity() actor: CurrentAccessIdentity, @Param() params: IdParamsDto, @Body() body: IncidentCommandDto, @Req() request: BackofficeRequest) { return this.incidents.command(actor.userId, this.roles(request), params.id, 'ACKNOWLEDGE', body.reason, body.clientRequestId, request.id); }
  @Post('incidents/:id/resolve') @HttpCode(200) @RequireBackofficePermission('OPERATIONAL_INCIDENTS_MANAGE')
  resolve(@CurrentIdentity() actor: CurrentAccessIdentity, @Param() params: IdParamsDto, @Body() body: IncidentCommandDto, @Req() request: BackofficeRequest) { return this.incidents.command(actor.userId, this.roles(request), params.id, 'RESOLVE', body.reason, body.clientRequestId, request.id); }

  @Get('governance/policies') @RequireBackofficePermission('DATA_GOVERNANCE_READ') policies() { return this.governance.policies(); }
  @Post('governance/policies') @RequireBackofficePermission('DATA_GOVERNANCE_MANAGE') createPolicy(@CurrentIdentity() actor: CurrentAccessIdentity, @Body() body: CreatePolicyDto, @Req() request: BackofficeRequest) { return this.governance.createPolicy(actor.userId, this.roles(request), body, request.id); }
  @Post('governance/policies/:id/activate') @HttpCode(200) @RequireBackofficePermission('DATA_GOVERNANCE_MANAGE') activatePolicy(@CurrentIdentity() actor: CurrentAccessIdentity, @Param() params: IdParamsDto, @Body() body: ReasonDto, @Req() request: BackofficeRequest) { return this.governance.activatePolicy(actor.userId, this.roles(request), params.id, body.reason, request.id); }
  @Post('governance/policies/:id/dry-runs') @RequireBackofficePermission('DATA_GOVERNANCE_MANAGE') dryRun(@CurrentIdentity() actor: CurrentAccessIdentity, @Param() params: IdParamsDto, @Body() body: DryRunDto, @Req() request: BackofficeRequest) { return this.governance.dryRun(actor.userId, this.roles(request), params.id, body.clientRequestId, request.id); }
  @Get('governance/holds') @RequireBackofficePermission('DATA_GOVERNANCE_READ') holds() { return this.governance.holds(); }
  @Post('governance/holds') @RequireBackofficePermission('DATA_GOVERNANCE_MANAGE') createHold(@CurrentIdentity() actor: CurrentAccessIdentity, @Body() body: CreateHoldDto, @Req() request: BackofficeRequest) { return this.governance.createHold(actor.userId, this.roles(request), { category: body.category, startsAt: new Date(body.startsAt), reason: body.reason, ...(body.targetType ? { targetType: body.targetType } : {}), ...(body.targetId ? { targetId: body.targetId } : {}), ...(body.endsAt ? { endsAt: new Date(body.endsAt) } : {}) }, request.id); }
  @Post('governance/holds/:id/release') @HttpCode(200) @RequireBackofficePermission('DATA_GOVERNANCE_MANAGE') releaseHold(@CurrentIdentity() actor: CurrentAccessIdentity, @Param() params: IdParamsDto, @Body() body: ReasonDto, @Req() request: BackofficeRequest) { return this.governance.releaseHold(actor.userId, this.roles(request), params.id, body.reason, request.id); }
  @Get('governance/runs') @RequireBackofficePermission('DATA_GOVERNANCE_READ') runs() { return this.governance.runs(); }
  @Post('governance/dry-runs/:id/runs') @RequireBackofficePermission('DATA_GOVERNANCE_MANAGE') createRun(@CurrentIdentity() actor: CurrentAccessIdentity, @Param() params: IdParamsDto, @Body() body: CreateRunDto, @Req() request: BackofficeRequest) { return this.governance.createRun(actor.userId, this.roles(request), params.id, body.confirmation, body.clientRequestId, request.id); }
  @Get('governance/deletion-evidence') @RequireBackofficePermission('DATA_GOVERNANCE_READ') evidence() { return this.governance.deletionEvidence(); }
  @Get('governance/recovery-drills') @RequireBackofficePermission('DATA_GOVERNANCE_READ') recoveryList() { return this.governance.recoveryDrills(); }
  @Post('governance/recovery-drills') @RequireBackofficePermission('RECOVERY_DRILLS_MANAGE') recovery(@CurrentIdentity() actor: CurrentAccessIdentity, @Body() body: RecoveryDrillDto, @Req() request: BackofficeRequest) { return this.governance.recordRecovery(actor.userId, this.roles(request), { ...body, startedAt: new Date(body.startedAt), completedAt: new Date(body.completedAt), ...(body.errorCode ? { errorCode: body.errorCode } : {}) }, request.id); }
}
