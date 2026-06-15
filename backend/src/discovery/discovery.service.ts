import { Injectable } from '@nestjs/common';
import type { DiscoveryQuery, Gender, UserCard } from '@linku/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PresenceService } from '../presence/presence.service';
import { BlocksService } from '../safety/blocks.service';
import { UsersService } from '../users/users.service';
import { toUserCard } from '../users/users.mapper';

const PAGE_SIZE = 20;

@Injectable()
export class DiscoveryService {
  constructor(
    private prisma: PrismaService,
    private presence: PresenceService,
    private blocks: BlocksService,
    private users: UsersService,
  ) {}

  async list(requesterId: string, q: DiscoveryQuery): Promise<UserCard[]> {
    const me = await this.users.getEntity(requesterId);

    // Default to opposite gender (heterosexual primary use-case), overridable via query.
    const targetGender: Gender | undefined =
      q.gender ??
      (me.gender === 'MALE' ? 'FEMALE' : me.gender === 'FEMALE' ? 'MALE' : undefined);

    const blockedIds = await this.blocks.blockedIdsFor(requesterId);

    const where: Record<string, unknown> = {
      id: { notIn: [requesterId, ...Array.from(blockedIds)] },
    };
    if (targetGender) where.gender = targetGender;
    if (q.lang) {
      where.OR = [
        { nativeLanguage: q.lang },
        { learningLanguages: { contains: `"${q.lang}"` } },
      ];
    }

    const candidates = await this.prisma.user.findMany({ where, take: 200 });
    const presence = await this.presence.getMany(candidates.map((c) => c.id));

    const myOffset = tzOffsetHours(me.timezone);

    let cards = candidates.map((c) => {
      const p = presence.get(c.id);
      const card = toUserCard(c) as UserCard & { _overlap: number };
      card.online = !!p?.online;
      card.availableForCall = !!p?.availableForCall;
      card._overlap = 24 - Math.abs(myOffset - tzOffsetHours(c.timezone));
      return card;
    });

    if (q.onlineOnly) cards = cards.filter((c) => c.online);

    // Sort: online > realPersonVerified > trustScore > timezone overlap
    cards.sort((a, b) => {
      const ao = a as UserCard & { _overlap: number };
      const bo = b as UserCard & { _overlap: number };
      return (
        Number(b.online) - Number(a.online) ||
        Number(b.realPersonVerified) - Number(a.realPersonVerified) ||
        b.trustScore - a.trustScore ||
        bo._overlap - ao._overlap
      );
    });

    const page = q.page ?? 0;
    const paged = cards.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
    // strip internal sort field
    return paged.map(({ ...c }) => {
      delete (c as { _overlap?: number })._overlap;
      return c;
    });
  }
}

function tzOffsetHours(tz: string | null | undefined): number {
  if (!tz) return 0;
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      timeZoneName: 'shortOffset',
    });
    const name =
      dtf.formatToParts(new Date(0)).find((p) => p.type === 'timeZoneName')?.value ?? '';
    const m = name.match(/GMT([+-]?\d{1,2})(?::(\d{2}))?/);
    if (!m) return 0;
    const h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) / 60 : 0;
    return h + (h < 0 ? -min : min);
  } catch {
    return 0;
  }
}
