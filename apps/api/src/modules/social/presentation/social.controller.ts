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
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import {
  CurrentIdentity,
  type CurrentAccessIdentity,
} from '../../../common/decorators/current-identity.decorator.js';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto.js';
import { SocialService } from '../application/services/social.service.js';
import {
  AvailableUserPageDto,
  BlockDto,
  BlockPageDto,
  FriendPageDto,
  FriendRequestDto,
  FriendRequestPageDto,
  FriendRequestPageQueryDto,
  FriendRequestParamsDto,
  PresenceDto,
  PresenceHeartbeatDto,
  RelationshipEndDto,
  SocialCommandDto,
  SocialCommandQueryDto,
  SocialPageQueryDto,
  SocialTargetCommandDto,
  SocialUserParamsDto,
} from './dto/social.dto.js';

@ApiTags('social')
@ApiBearerAuth()
@ApiBadRequestResponse({ type: ErrorResponseDto })
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@ApiForbiddenResponse({ type: ErrorResponseDto })
@ApiNotFoundResponse({ type: ErrorResponseDto })
@ApiConflictResponse({ type: ErrorResponseDto })
@ApiServiceUnavailableResponse({ type: ErrorResponseDto })
@Controller()
export class SocialController {
  constructor(private readonly social: SocialService) {}

  @Post('friend-requests')
  @ApiCreatedResponse({ type: FriendRequestDto })
  async createRequest(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Body() body: SocialTargetCommandDto,
  ) {
    return this.request(await this.social.createFriendRequest(identity.userId, body));
  }

  @Get('friend-requests')
  @ApiOkResponse({ type: FriendRequestPageDto })
  async requests(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Query() query: FriendRequestPageQueryDto,
  ) {
    const page = await this.social.listFriendRequests(identity.userId, query);
    return { ...page, items: page.items.map((item) => ({ ...this.request(item), peerDisplayName: item.peerDisplayName })) };
  }

  @Post('friend-requests/:requestId/accept')
  @HttpCode(200)
  @ApiOkResponse({ type: FriendRequestDto })
  accept(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: FriendRequestParamsDto,
    @Body() body: SocialCommandDto,
  ) {
    return this.resolve(identity.userId, params.requestId, 'accept', body.clientRequestId);
  }

  @Post('friend-requests/:requestId/reject')
  @HttpCode(200)
  @ApiOkResponse({ type: FriendRequestDto })
  reject(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: FriendRequestParamsDto,
    @Body() body: SocialCommandDto,
  ) {
    return this.resolve(identity.userId, params.requestId, 'reject', body.clientRequestId);
  }

  @Post('friend-requests/:requestId/withdraw')
  @HttpCode(200)
  @ApiOkResponse({ type: FriendRequestDto })
  withdraw(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: FriendRequestParamsDto,
    @Body() body: SocialCommandDto,
  ) {
    return this.resolve(identity.userId, params.requestId, 'withdraw', body.clientRequestId);
  }

  @Get('me/friends')
  @ApiOkResponse({ type: FriendPageDto })
  friends(@CurrentIdentity() identity: CurrentAccessIdentity, @Query() query: SocialPageQueryDto) {
    return this.social.listFriends(identity.userId, query);
  }

  @Delete('me/friends/:userId')
  @ApiOkResponse({ type: RelationshipEndDto })
  async deleteFriend(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: SocialUserParamsDto,
    @Query() query: SocialCommandQueryDto,
  ) {
    const result = await this.social.deleteFriend(
      identity.userId,
      params.userId,
      query.clientRequestId,
    );
    return { id: result.friendshipId, endedAt: result.endedAt.toISOString() };
  }

  @Post('blocks')
  @ApiCreatedResponse({ type: BlockDto })
  async block(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Body() body: SocialTargetCommandDto,
  ) {
    const result = await this.social.createBlock(identity.userId, body);
    return { ...result, createdAt: result.createdAt.toISOString() };
  }

  @Get('blocks')
  @ApiOkResponse({ type: BlockPageDto })
  async blocks(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Query() query: SocialPageQueryDto,
  ) {
    const page = await this.social.listBlocks(identity.userId, query);
    return {
      ...page,
      items: page.items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    };
  }

  @Delete('blocks/:userId')
  @ApiOkResponse({ type: RelationshipEndDto })
  async unblock(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: SocialUserParamsDto,
    @Query() query: SocialCommandQueryDto,
  ) {
    const result = await this.social.deleteBlock(
      identity.userId,
      params.userId,
      query.clientRequestId,
    );
    return { id: result.blockId, endedAt: result.unblockedAt.toISOString() };
  }

  @Post('me/presence/heartbeat')
  @HttpCode(200)
  @ApiOkResponse({ type: PresenceDto })
  async heartbeat(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Body() _body: PresenceHeartbeatDto,
  ) {
    const result = await this.social.heartbeat(identity.userId);
    return { ...result, expiresAt: result.expiresAt.toISOString() };
  }

  @Get('people/available')
  @ApiOkResponse({ type: AvailableUserPageDto })
  available(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Query() query: SocialPageQueryDto,
  ) {
    return this.social.listAvailable(identity.userId, query);
  }

  private async resolve(
    userId: string,
    requestId: string,
    action: 'accept' | 'reject' | 'withdraw',
    clientRequestId: string,
  ) {
    return this.request(
      await this.social.resolveFriendRequest(userId, requestId, action, clientRequestId),
    );
  }

  private request(value: {
    id: string;
    requesterUserId: string;
    recipientUserId: string;
    status: string;
    createdAt: Date;
    resolvedAt: Date | null;
  }) {
    return {
      ...value,
      createdAt: value.createdAt.toISOString(),
      resolvedAt: value.resolvedAt?.toISOString() ?? null,
    };
  }
}
