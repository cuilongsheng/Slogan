import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import {
  CurrentIdentity,
  type CurrentAccessIdentity,
} from '../../../common/decorators/current-identity.decorator.js';
import { AccountLifecycleService } from '../application/services/account-lifecycle.service.js';
import {
  AccountDeletionResponseDto,
  DeleteAccountDto,
  RestrictedAccountParamsDto,
  RestrictedAccountRecordDto,
} from './dto/account-lifecycle.dto.js';

type RequestWithId = Request & { id?: string };

@ApiTags('account-lifecycle')
@ApiBearerAuth()
@Controller()
export class AccountLifecycleController {
  constructor(private readonly lifecycle: AccountLifecycleService) {}

  @Post('me/account/deletion')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AccountDeletionResponseDto })
  async deleteAccount(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Body() body: DeleteAccountDto,
  ): Promise<AccountDeletionResponseDto> {
    const result = await this.lifecycle.deleteAccount({ userId: identity.userId, ...body });
    return { ...result, deletedAt: result.deletedAt.toISOString() };
  }

  @Get('backoffice/accounts/:userId/restricted-record')
  @ApiOkResponse({ type: RestrictedAccountRecordDto })
  async restrictedRecord(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: RestrictedAccountParamsDto,
    @Req() request: RequestWithId,
  ): Promise<RestrictedAccountRecordDto> {
    const record = await this.lifecycle.restrictedRecord(
      identity.userId,
      params.userId,
      request.id,
    );
    return {
      ...record,
      createdAt: record.createdAt.toISOString(),
      deletedAt: record.deletedAt.toISOString(),
    };
  }
}
