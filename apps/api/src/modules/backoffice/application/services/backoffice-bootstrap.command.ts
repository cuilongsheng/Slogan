import { Injectable } from '@nestjs/common';
import { BackofficeService } from './backoffice.service.js';

@Injectable()
export class BackofficeBootstrapCommand {
  constructor(private readonly service: BackofficeService) {}
  async execute(userId: string) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
    ) {
      throw new Error('BACKOFFICE_BOOTSTRAP_USER_ID_INVALID');
    }
    return { userId, ...(await this.service.bootstrap(userId)) };
  }
}
