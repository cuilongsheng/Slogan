import { Prisma } from '../../../generated/prisma/client.js';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { AppError } from '../../../common/errors/app-error.js';
import type { AvatarRepository } from '../domain/ports/avatar.repository.js';
@Injectable()
export class PrismaAvatarRepository implements AvatarRepository {
  constructor(private readonly prisma: PrismaService) {}
  async replace(userId: string, id: string, image: Uint8Array, sha256: string, url: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "User" WHERE id=${userId}::uuid FOR UPDATE`);
      const user = await tx.user.findUnique({ where: { id: userId }, select: { status: true } });
      if (user?.status !== 'ACTIVE')
        throw new AppError('AVATAR_UNAVAILABLE', 'Profile image cannot be changed', 403);
      await tx.profileAvatar.upsert({
        where: { userId },
        create: { id, userId, image: new Uint8Array(image), sha256 },
        update: { id, image: new Uint8Array(image), sha256 },
      });
      await tx.userProfile.updateMany({ where: { userId }, data: { avatarUrl: url } });
    });
  }
  async find(id: string) {
    return this.prisma.profileAvatar.findFirst({
      where: { id, user: { status: 'ACTIVE' } },
      select: { image: true, sha256: true },
    });
  }
}
