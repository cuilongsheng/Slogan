import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
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
import { DirectService } from '../application/direct.service.js';
import type {
  DirectCallRecord,
  DirectMessageRecord,
  DirectConversationRecord,
} from '../domain/direct.js';
import { ReportReceiptDto } from '../../moderation/index.js';
import {
  ConversationParamsDto,
  DirectCallParamsDto,
  DirectReportParamsDto,
  DirectPageQueryDto,
  OpenConversationDto,
  SendDirectMessageDto,
  DirectReadDto,
  DirectCommandDto,
  DirectReportDto,
  DirectConversationDto,
  DirectConversationPageDto,
  DirectUnreadDto,
  DirectMessageDto,
  DirectMessagePageDto,
  DirectCallDto,
  DirectCallPageDto,
  DirectCallHistoryPageDto,
  DirectCredentialsDto,
} from './direct.dto.js';

const message = (x: DirectMessageRecord) => ({ ...x, createdAt: x.createdAt.toISOString() });
const conversation = (x: DirectConversationRecord) => ({
  ...x,
  lastActivityAt: x.lastActivityAt.toISOString(),
  lastMessage: x.lastMessage ? message(x.lastMessage) : null,
  lastCall: x.lastCall ? call(x.lastCall) : null,
});
const call = (x: DirectCallRecord) => ({
  id: x.id,
  conversationId: x.conversationId,
  sequence: x.sequence,
  callerUserId: x.callerUserId,
  calleeUserId: x.calleeUserId,
  status: x.status,
  expiresAt: x.expiresAt.toISOString(),
  acceptedAt: x.acceptedAt?.toISOString() ?? null,
  endedAt: x.endedAt?.toISOString() ?? null,
  endReason: x.endReason,
  ...(x.peer ? { peer: x.peer } : {}),
});
@ApiTooManyRequestsResponse({ type: ErrorResponseDto })
@ApiTags('direct-conversations')
@ApiBearerAuth()
@ApiBadRequestResponse({ type: ErrorResponseDto })
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@ApiForbiddenResponse({ type: ErrorResponseDto })
@ApiNotFoundResponse({ type: ErrorResponseDto })
@ApiConflictResponse({ type: ErrorResponseDto })
@ApiServiceUnavailableResponse({ type: ErrorResponseDto })
@Controller()
export class DirectController {
  constructor(private readonly direct: DirectService) {}
  @Post('conversations')
  @ApiCreatedResponse({ type: DirectConversationDto })
  async open(@CurrentIdentity() who: CurrentAccessIdentity, @Body() body: OpenConversationDto) {
    return conversation(await this.direct.open(who.userId, body.targetUserId));
  }
  @Get('me/conversations/unread')
  @ApiOkResponse({ type: DirectUnreadDto })
  async unread(@CurrentIdentity() who: CurrentAccessIdentity) {
    return { unreadCount: await this.direct.unreadCount(who.userId) };
  }
  @Get('me/conversations')
  @ApiOkResponse({ type: DirectConversationPageDto })
  async list(@CurrentIdentity() who: CurrentAccessIdentity, @Query() query: DirectPageQueryDto) {
    const page = await this.direct.conversations(who.userId, query);
    return { ...page, items: page.items.map(conversation) };
  }
  @Get('conversations/:conversationId')
  @ApiOkResponse({ type: DirectConversationDto })
  async detail(@CurrentIdentity() who: CurrentAccessIdentity, @Param() p: ConversationParamsDto) {
    return conversation(await this.direct.detail(who.userId, p.conversationId));
  }
  @Get('conversations/:conversationId/messages')
  @ApiOkResponse({ type: DirectMessagePageDto })
  async messages(
    @CurrentIdentity() who: CurrentAccessIdentity,
    @Param() p: ConversationParamsDto,
    @Query() query: DirectPageQueryDto,
  ) {
    const page = await this.direct.messages(who.userId, p.conversationId, query);
    return { ...page, items: page.items.map(message) };
  }
  @Post('conversations/:conversationId/messages')
  @ApiCreatedResponse({ type: DirectMessageDto })
  async send(
    @CurrentIdentity() who: CurrentAccessIdentity,
    @Param() p: ConversationParamsDto,
    @Body() body: SendDirectMessageDto,
  ) {
    return message(
      await this.direct.send(who.userId, p.conversationId, body.text, body.clientRequestId),
    );
  }
  @Post('conversations/:conversationId/read')
  @HttpCode(200)
  @ApiOkResponse({ type: DirectConversationDto })
  async read(
    @CurrentIdentity() who: CurrentAccessIdentity,
    @Param() p: ConversationParamsDto,
    @Body() body: DirectReadDto,
  ) {
    await this.direct.read(who.userId, p.conversationId, body.sequence);
    return conversation(await this.direct.detail(who.userId, p.conversationId));
  }
  @Delete('conversations/:conversationId')
  @HttpCode(200)
  @ApiOkResponse({ type: DirectConversationDto })
  async hide(
    @CurrentIdentity() who: CurrentAccessIdentity,
    @Param() p: ConversationParamsDto,
    @Body() body: DirectCommandDto,
  ) {
    await this.direct.hide(who.userId, p.conversationId, body.clientRequestId);
    return conversation(await this.direct.detail(who.userId, p.conversationId));
  }
  @Post('conversations/:conversationId/messages/:messageId/report')
  @ApiCreatedResponse({ type: ReportReceiptDto })
  async report(
    @CurrentIdentity() who: CurrentAccessIdentity,
    @Param() p: DirectReportParamsDto,
    @Body() body: DirectReportDto,
  ) {
    const result = await this.direct.report(
      who.userId,
      p.conversationId,
      p.messageId,
      body.category,
      body.description.trim(),
      body.clientRequestId,
    );
    return { ...result, submittedAt: result.submittedAt.toISOString() };
  }
  @Get('conversations/:conversationId/calls')
  @ApiOkResponse({ type: DirectCallHistoryPageDto })
  async callHistory(
    @CurrentIdentity() who: CurrentAccessIdentity,
    @Param() p: ConversationParamsDto,
    @Query() query: DirectPageQueryDto,
  ) {
    const page = await this.direct.callHistory(who.userId, p.conversationId, query);
    return { ...page, items: page.items.map(call) };
  }
  @Post('conversations/:conversationId/calls')
  @ApiCreatedResponse({ type: DirectCallDto })
  async requestCall(
    @CurrentIdentity() who: CurrentAccessIdentity,
    @Param() p: ConversationParamsDto,
    @Body() body: DirectCommandDto,
  ) {
    return call(await this.direct.requestCall(who.userId, p.conversationId, body.clientRequestId));
  }
  @Get('me/direct-calls')
  @ApiOkResponse({ type: DirectCallPageDto })
  async calls(@CurrentIdentity() who: CurrentAccessIdentity) {
    return { items: (await this.direct.calls(who.userId)).map(call) };
  }
  @Get('direct-calls/:callId')
  @ApiOkResponse({ type: DirectCallDto })
  async call(@CurrentIdentity() who: CurrentAccessIdentity, @Param() p: DirectCallParamsDto) {
    return call(await this.direct.call(who.userId, p.callId));
  }
  @Post('direct-calls/:callId/accept')
  @HttpCode(200)
  @ApiOkResponse({ type: DirectCallDto })
  async accept(
    @CurrentIdentity() who: CurrentAccessIdentity,
    @Param() p: DirectCallParamsDto,
    @Body() body: DirectCommandDto,
  ) {
    return call(await this.direct.actCall(who.userId, p.callId, 'accept', body.clientRequestId));
  }
  @Post('direct-calls/:callId/reject')
  @HttpCode(200)
  @ApiOkResponse({ type: DirectCallDto })
  async reject(
    @CurrentIdentity() who: CurrentAccessIdentity,
    @Param() p: DirectCallParamsDto,
    @Body() body: DirectCommandDto,
  ) {
    return call(await this.direct.actCall(who.userId, p.callId, 'reject', body.clientRequestId));
  }
  @Post('direct-calls/:callId/end')
  @HttpCode(200)
  @ApiOkResponse({ type: DirectCallDto })
  async end(
    @CurrentIdentity() who: CurrentAccessIdentity,
    @Param() p: DirectCallParamsDto,
    @Body() body: DirectCommandDto,
  ) {
    return call(await this.direct.actCall(who.userId, p.callId, 'end', body.clientRequestId));
  }
  @Post('direct-calls/:callId/heartbeat')
  @HttpCode(200)
  @ApiOkResponse({ type: DirectCallDto })
  async heartbeat(@CurrentIdentity() who: CurrentAccessIdentity, @Param() p: DirectCallParamsDto) {
    return call(await this.direct.heartbeat(who.userId, p.callId));
  }
  @Post('direct-calls/:callId/credentials')
  @HttpCode(200)
  @ApiOkResponse({ type: DirectCredentialsDto })
  credentials(@CurrentIdentity() who: CurrentAccessIdentity, @Param() p: DirectCallParamsDto) {
    return this.direct.credentials(who.userId, p.callId);
  }
}
