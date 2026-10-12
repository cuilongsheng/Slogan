import { createHash, randomUUID } from 'node:crypto';
import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../../config/environment.js';
import {
  AVATAR_IMAGE,
  AVATAR_REPOSITORY,
  type AvatarImage,
  type AvatarRepository,
} from '../../domain/ports/avatar.repository.js';
@Injectable()
export class AvatarService {
  constructor(
    @Inject(AVATAR_REPOSITORY) private readonly repository: AvatarRepository,
    private readonly config: ConfigService<Environment, true>,
    @Inject(AVATAR_IMAGE) private readonly images: AvatarImage,
  ) {}
  async replace(userId: string, base64: string) {
    const image = this.images.normalize(base64),
      id = randomUUID(),
      sha256 = createHash('sha256').update(image).digest('hex');
    const avatarUrl = new URL(
      `/v1/avatars/${id}`,
      this.config.get('ROOM_SHARE_BASE_URL', { infer: true }),
    ).toString();
    await this.repository.replace(userId, id, image, sha256, avatarUrl);
    return { avatarUrl };
  }
  defaultImage() {
    return this.images.defaultImage();
  }
  find(id: string) {
    return this.repository.find(id);
  }
}
