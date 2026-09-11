import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import type { ProfileData, ProfileRecord } from '../domain/entities/profile.js';
import type { ProfileRepository } from '../domain/ports/profile.repository.js';

@Injectable()
export class PrismaProfileRepository implements ProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<ProfileRecord | null> {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    if (profile === null) return null;
    return {
      userId: profile.userId,
      avatarUrl: profile.avatarUrl,
      displayName: profile.displayName,
      genderCode: profile.genderCode as ProfileRecord['genderCode'],
      ...(profile.nationalityCode === null ? {} : { nationalityCode: profile.nationalityCode }),
      ...(profile.city === null ? {} : { city: profile.city }),
      interestCodes: profile.interestCodes,
      cefrLevel: profile.cefrLevel,
      birthYear: profile.birthYear,
      birthMonth: profile.birthMonth,
      completedAt: profile.completedAt,
    };
  }

  async upsert(userId: string, profile: ProfileData, completedAt: Date): Promise<ProfileRecord> {
    await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const saved = await this.prisma.userProfile.upsert({
      where: { userId },
      create: { userId, ...profile, completedAt },
      update: { ...profile, completedAt },
    });
    return {
      userId: saved.userId,
      avatarUrl: saved.avatarUrl,
      displayName: saved.displayName,
      genderCode: saved.genderCode as ProfileRecord['genderCode'],
      ...(saved.nationalityCode === null ? {} : { nationalityCode: saved.nationalityCode }),
      ...(saved.city === null ? {} : { city: saved.city }),
      interestCodes: saved.interestCodes,
      cefrLevel: saved.cefrLevel,
      birthYear: saved.birthYear,
      birthMonth: saved.birthMonth,
      completedAt: saved.completedAt,
    };
  }
}
