import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
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
import { PostRoomLearningService } from '../application/post-room-learning.service.js';
import {
  DeleteVocabularyItemDto,
  ImportVocabularyItemDto,
  KeywordSummaryDto,
  KeywordSummaryRoomParamsDto,
  ListVocabularyItemsQueryDto,
  UpdateVocabularyItemDto,
  VocabularyItemDto,
  VocabularyItemListDto,
  VocabularyItemParamsDto,
} from './dto/post-room-learning.dto.js';

@ApiTags('post-room-learning')
@ApiBearerAuth()
@ApiBadRequestResponse({ type: ErrorResponseDto })
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@ApiForbiddenResponse({ type: ErrorResponseDto })
@ApiNotFoundResponse({ type: ErrorResponseDto })
@ApiConflictResponse({ type: ErrorResponseDto })
@Controller()
export class PostRoomLearningController {
  constructor(private readonly learning: PostRoomLearningService) {}

  @Get('rooms/:roomId/keyword-summary')
  @ApiOkResponse({ type: KeywordSummaryDto })
  async summary(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: KeywordSummaryRoomParamsDto,
  ) {
    const summary = await this.learning.getSummary(identity.userId, params.roomId);
    return {
      ...summary,
      generatedAt: summary.generatedAt?.toISOString() ?? null,
    };
  }

  @Post('me/vocabulary-items')
  @ApiCreatedResponse({ type: VocabularyItemDto })
  async import(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Body() body: ImportVocabularyItemDto,
  ) {
    return this.present(await this.learning.importItem(identity.userId, body));
  }

  @Get('me/vocabulary-items')
  @ApiOkResponse({ type: VocabularyItemListDto })
  async list(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Query() query: ListVocabularyItemsQueryDto,
  ) {
    const page = await this.learning.listItems(identity.userId, query);
    return { items: page.items.map((item) => this.present(item)), nextCursor: page.nextCursor };
  }

  @Put('me/vocabulary-items/:itemId')
  @ApiOkResponse({ type: VocabularyItemDto })
  async update(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: VocabularyItemParamsDto,
    @Body() body: UpdateVocabularyItemDto,
  ) {
    return this.present(await this.learning.updateItem(identity.userId, params.itemId, body));
  }

  @Delete('me/vocabulary-items/:itemId')
  @HttpCode(204)
  @ApiNoContentResponse()
  async delete(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: VocabularyItemParamsDto,
    @Body() body: DeleteVocabularyItemDto,
  ) {
    await this.learning.deleteItem(identity.userId, params.itemId, body.expectedVersion);
  }

  private present(item: Awaited<ReturnType<PostRoomLearningService['importItem']>>) {
    return {
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}
