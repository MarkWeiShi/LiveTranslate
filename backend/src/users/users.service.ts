import { Injectable, NotFoundException } from '@nestjs/common';
import { DEFAULT_TRIAL_SECONDS, type MeDto, type UpdateMeBody, type UserCard } from '@linku/shared';
import { PrismaService } from '../prisma/prisma.service';
import { serializeStrArr } from '../common/json-array.util';
import { toUserCard, toWalletDto } from './users.mapper';
import type { HelloTalkProfile } from '../adapters/auth/auth-provider.interface';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /** First login creates User + Wallet; repeat login updates and never duplicates (AC-AUTH-2). */
  async upsertFromProfile(
    p: HelloTalkProfile,
  ): Promise<{ card: UserCard; isNewUser: boolean }> {
    const existing = await this.prisma.user.findUnique({
      where: { helloTalkUserId: p.sub },
    });
    const data = {
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      nativeLanguage: p.nativeLanguage,
      learningLanguages: serializeStrArr(p.learningLanguages),
      languageLevel: p.languageLevel,
      gender: p.gender,
      region: p.region,
      timezone: p.timezone,
      bio: p.bio,
      interests: serializeStrArr(p.interests),
      realPersonVerified: p.realPersonVerified,
      trustScore: p.trustScore,
    };
    if (existing) {
      const updated = await this.prisma.user.update({
        where: { id: existing.id },
        data,
      });
      return { card: toUserCard(updated), isNewUser: false };
    }
    const created = await this.prisma.user.create({
      data: {
        helloTalkUserId: p.sub,
        ...data,
        wallet: { create: { trialSecondsLeft: DEFAULT_TRIAL_SECONDS } },
      },
    });
    return { card: toUserCard(created), isNewUser: true };
  }

  async getEntity(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    return u;
  }

  async getMe(userId: string): Promise<MeDto> {
    const u = await this.getEntity(userId);
    let wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: { userId, trialSecondsLeft: DEFAULT_TRIAL_SECONDS },
      });
    }
    return { ...toUserCard(u), wallet: toWalletDto(wallet) };
  }

  async updateMe(userId: string, body: UpdateMeBody): Promise<UserCard> {
    await this.getEntity(userId);
    const data: Record<string, unknown> = {};
    if (body.intent !== undefined) data.intent = body.intent;
    if (body.bio !== undefined) data.bio = body.bio;
    if (body.nativeLanguage !== undefined) data.nativeLanguage = body.nativeLanguage;
    if (body.learningLanguages !== undefined)
      data.learningLanguages = serializeStrArr(body.learningLanguages);
    const updated = await this.prisma.user.update({ where: { id: userId }, data });
    return toUserCard(updated);
  }

  async getCard(userId: string): Promise<UserCard> {
    const u = await this.getEntity(userId);
    return toUserCard(u);
  }
}
