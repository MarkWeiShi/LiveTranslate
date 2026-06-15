import { ForbiddenException, Injectable } from '@nestjs/common';
import type { FriendDto } from '@linku/shared';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class FriendsService {
  constructor(
    private prisma: PrismaService,
    private users: UsersService,
  ) {}

  private pair(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
  }

  async add(userId: string, friendId: string): Promise<FriendDto> {
    if (userId === friendId)
      throw new ForbiddenException({ code: 'CANNOT_FRIEND_SELF', message: 'Cannot friend yourself' });
    await this.users.getEntity(friendId);
    const [userIdA, userIdB] = this.pair(userId, friendId);
    const f = await this.prisma.friendship.upsert({
      where: { userIdA_userIdB: { userIdA, userIdB } },
      update: { status: 'ACCEPTED' },
      create: { userIdA, userIdB, status: 'ACCEPTED' },
    });
    const card = await this.users.getCard(friendId);
    return { ...card, friendshipId: f.id, friendStatus: f.status };
  }

  async list(userId: string): Promise<FriendDto[]> {
    const rows = await this.prisma.friendship.findMany({
      where: { OR: [{ userIdA: userId }, { userIdB: userId }] },
      orderBy: { createdAt: 'desc' },
    });
    const out: FriendDto[] = [];
    for (const f of rows) {
      const peerId = f.userIdA === userId ? f.userIdB : f.userIdA;
      try {
        const card = await this.users.getCard(peerId);
        out.push({ ...card, friendshipId: f.id, friendStatus: f.status });
      } catch {
        /* peer deleted */
      }
    }
    return out;
  }
}
