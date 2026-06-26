import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  levelFromXp,
  xpToNextLevel,
  type AwardXpResult,
  type BondDto,
  type FamilyDto,
  type FamilyLeaderboardDto,
  type GrowthProfileDto,
} from '@linku/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GrowthService {
  constructor(private prisma: PrismaService) {}

  // ---- 个人积分/等级 ----
  async profile(userId: string): Promise<GrowthProfileDto> {
    const p = await this.prisma.growthProfile.findUnique({ where: { userId } });
    const xp = p?.xp ?? 0;
    return { userId, xp, level: levelFromXp(xp), toNext: xpToNextLevel(xp) };
  }

  async award(userId: string, amount: number): Promise<AwardXpResult> {
    const before = await this.prisma.growthProfile.findUnique({ where: { userId } });
    const beforeLevel = levelFromXp(before?.xp ?? 0);
    const xp = (before?.xp ?? 0) + amount;
    const level = levelFromXp(xp);
    await this.prisma.growthProfile.upsert({
      where: { userId },
      create: { userId, xp, level },
      update: { xp, level },
    });
    return { userId, xp, level, toNext: xpToNextLevel(xp), leveledUp: level > beforeLevel };
  }

  // ---- 跨国 CP 亲密度 ----
  private pair(a: string, b: string) {
    return a < b ? { userLo: a, userHi: b } : { userLo: b, userHi: a };
  }

  async addBond(me: string, peerId: string, amount = 10): Promise<BondDto> {
    if (peerId === me) throw new BadRequestException({ code: 'SELF_BOND' });
    const key = this.pair(me, peerId);
    const row = await this.prisma.bond.upsert({
      where: { userLo_userHi: key },
      create: { ...key, intimacy: amount },
      update: { intimacy: { increment: amount } },
    });
    return { peerId, intimacy: row.intimacy, level: levelFromXp(row.intimacy) };
  }

  async getBond(me: string, peerId: string): Promise<BondDto> {
    const key = this.pair(me, peerId);
    const row = await this.prisma.bond.findUnique({ where: { userLo_userHi: key } });
    const intimacy = row?.intimacy ?? 0;
    return { peerId, intimacy, level: levelFromXp(intimacy) };
  }

  // ---- 家族战 ----
  private async familyDto(id: string): Promise<FamilyDto> {
    const f = await this.prisma.family.findUnique({ where: { id } });
    if (!f) throw new NotFoundException({ code: 'FAMILY_NOT_FOUND' });
    const members = await this.prisma.familyMember.count({ where: { familyId: id } });
    return { id: f.id, name: f.name, score: f.score, members };
  }

  async createFamily(userId: string, name: string): Promise<FamilyDto> {
    const f = await this.prisma.family.create({ data: { name } });
    await this.prisma.familyMember.create({ data: { familyId: f.id, userId } });
    return this.familyDto(f.id);
  }

  async joinFamily(userId: string, familyId: string): Promise<FamilyDto> {
    await this.familyDto(familyId); // 校验存在
    await this.prisma.familyMember.upsert({
      where: { familyId_userId: { familyId, userId } },
      create: { familyId, userId },
      update: {},
    });
    return this.familyDto(familyId);
  }

  async contribute(userId: string, familyId: string, amount: number): Promise<FamilyDto> {
    const member = await this.prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId, userId } },
    });
    if (!member) throw new BadRequestException({ code: 'NOT_IN_FAMILY' });
    await this.prisma.$transaction([
      this.prisma.family.update({ where: { id: familyId }, data: { score: { increment: amount } } }),
      this.prisma.familyMember.update({
        where: { familyId_userId: { familyId, userId } },
        data: { contribution: { increment: amount } },
      }),
    ]);
    return this.familyDto(familyId);
  }

  async leaderboard(): Promise<FamilyLeaderboardDto> {
    const fs = await this.prisma.family.findMany({ orderBy: { score: 'desc' }, take: 20 });
    const families: FamilyDto[] = [];
    for (const f of fs) {
      const members = await this.prisma.familyMember.count({ where: { familyId: f.id } });
      families.push({ id: f.id, name: f.name, score: f.score, members });
    }
    return { families };
  }
}
