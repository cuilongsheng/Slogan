import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { isAdultProfile, ProfileValidationError } from '../domain/policies/profile.policy.js';
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
      ...(profile.genderCode === null
        ? {}
        : { genderCode: profile.genderCode as NonNullable<ProfileRecord['genderCode']> }),
      ...(profile.nationalityCode === null ? {} : { nationalityCode: profile.nationalityCode }),
      ...(profile.city === null ? {} : { city: profile.city }),
      interestCodes: profile.interestCodes,
      cefrLevel: profile.cefrLevel,
      ...(profile.birthYear === null ? {} : { birthYear: profile.birthYear }),
      ...(profile.birthMonth === null ? {} : { birthMonth: profile.birthMonth }),
      ...(profile.adultConfirmedAt === null ? {} : { adultConfirmedAt: profile.adultConfirmedAt }),
      completedAt: profile.completedAt,
    };
  }

  async upsert(userId: string, profile: ProfileData, completedAt: Date): Promise<ProfileRecord> {
    const saved = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      await tx.user.findUniqueOrThrow({ where: { id: userId } });
      const previous = await tx.userProfile.findUnique({ where: { userId } });
      if (
        previous?.birthYear != null &&
        !isAdultProfile(previous, completedAt) &&
        (profile.birthYear !== previous.birthYear || profile.birthMonth !== previous.birthMonth)
      )
        throw new ProfileValidationError(['birthYear', 'birthMonth']);
      const data = {
        ...profile,
        genderCode: profile.genderCode ?? null,
        nationalityCode: profile.nationalityCode ?? null,
        city: profile.city ?? null,
        birthYear: profile.birthYear ?? null,
        birthMonth: profile.birthMonth ?? null,
        adultConfirmedAt: previous?.adultConfirmedAt ?? profile.adultConfirmedAt ?? null,
        completedAt: previous?.completedAt ?? completedAt,
      };
      return tx.userProfile.upsert({
        where: { userId },
        create: { userId, ...data },
        update: data,
      });
    });
    return {
      userId: saved.userId,
      avatarUrl: saved.avatarUrl,
      displayName: saved.displayName,
      ...(saved.genderCode === null
        ? {}
        : { genderCode: saved.genderCode as NonNullable<ProfileRecord['genderCode']> }),
      ...(saved.nationalityCode === null ? {} : { nationalityCode: saved.nationalityCode }),
      ...(saved.city === null ? {} : { city: saved.city }),
      interestCodes: saved.interestCodes,
      cefrLevel: saved.cefrLevel,
      ...(saved.birthYear === null ? {} : { birthYear: saved.birthYear }),
      ...(saved.birthMonth === null ? {} : { birthMonth: saved.birthMonth }),
      ...(saved.adultConfirmedAt === null ? {} : { adultConfirmedAt: saved.adultConfirmedAt }),
      completedAt: saved.completedAt,
    };
  }
}
