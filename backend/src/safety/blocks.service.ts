import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { BlockDto } from '@linku/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BlocksService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, blockedUserId: string): Promise<BlockDto> {
    if (userId === blockedUserId)
      throw new ForbiddenException({ code: 'CANNOT_BLOCK_SELF', message: 'Cannot block yourself' });
    const block = await this.prisma.block.upsert({
      where: { userId_blockedUserId: { userId, blockedUserId } },
      update: {},
      create: { userId, blockedUserId },
    });
    return this.toDto(block);
  }

  async remove(userId: string, blockId: string): Promise<void> {
    const b = await this.prisma.block.findUnique({ where: { id: blockId } });
    if (!b || b.userId !== userId)
      throw new NotFoundException({ code: 'BLOCK_NOT_FOUND', message: 'Block not found' });
    await this.prisma.block.delete({ where: { id: blockId } });
  }

  async list(userId: string): Promise<BlockDto[]> {
    const rows = await this.prisma.block.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((b) => this.toDto(b));
  }

  /** True if a blocks b OR b blocks a (either direction). */
  async isBlockedEither(a: string, b: string): Promise<boolean> {
    const row = await this.prisma.block.findFirst({
      where: {
        OR: [
          { userId: a, blockedUserId: b },
          { userId: b, blockedUserId: a },
        ],
      },
    });
    return !!row;
  }

  /** All user ids to hide from `userId` (ones they blocked + ones who blocked them). */
  async blockedIdsFor(userId: string): Promise<Set<string>> {
    const rows = await this.prisma.block.findMany({
      where: { OR: [{ userId }, { blockedUserId: userId }] },
    });
    const ids = new Set<string>();
    for (const r of rows) {
      ids.add(r.userId === userId ? r.blockedUserId : r.userId);
    }
    return ids;
  }

  private toDto(b: { id: string; userId: string; blockedUserId: string; createdAt: Date }): BlockDto {
    return {
      id: b.id,
      userId: b.userId,
      blockedUserId: b.blockedUserId,
      createdAt: b.createdAt.toISOString(),
    };
  }
}
