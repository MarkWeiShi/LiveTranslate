import { BadRequestException, Injectable } from '@nestjs/common';
import {
  channelFromSource,
  parseTelegramInitData,
  FUNNEL_STAGES,
  type AttributionDto,
  type FunnelDto,
  type FunnelStage,
} from '@linku/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttributionDto, CreateFunnelEventDto } from './dto/create-attribution.dto';
import { verifyTelegramInitData } from './telegram-verify';

@Injectable()
export class AttributionService {
  constructor(private prisma: PrismaService) {}

  async record(body: CreateAttributionDto): Promise<AttributionDto> {
    // Telegram：可选 HMAC 校验（ATTRIBUTION_VERIFY=telegram + TELEGRAM_BOT_TOKEN，属 human checkpoint）。
    const verifyMode = process.env.ATTRIBUTION_VERIFY ?? 'mock';
    const botToken = process.env.TELEGRAM_BOT_TOKEN ?? '';
    let verified = false;
    if (body.tgWebAppData && verifyMode === 'telegram') {
      const r = verifyTelegramInitData(body.tgWebAppData, botToken, { maxAgeSec: 86400 });
      if (!r.ok) throw new BadRequestException({ code: 'BAD_TELEGRAM_INITDATA', reason: r.reason });
      verified = true;
    }

    const ctx = body.tgWebAppData ? parseTelegramInitData(body.tgWebAppData) : null;
    const utm = body.utm ?? {};
    // 渠道判定：telegram > 显式 source > utm.source > direct
    const sourceRaw = ctx ? 'telegram' : (body.source ?? utm.source ?? null);
    const channel = ctx ? 'telegram' : channelFromSource(sourceRaw);
    const ref = ctx?.startParam ?? utm.ref ?? null;

    const a = await this.prisma.attribution.create({
      data: {
        source: sourceRaw,
        channel,
        externalId: ctx?.user?.id != null ? String(ctx.user.id) : null,
        username: ctx?.user?.username ?? null,
        startParam: ctx?.startParam ?? null,
        ref,
        campaign: utm.campaign ?? null,
        medium: utm.medium ?? null,
        raw: body.tgWebAppData ?? null,
        verified,
      },
    });

    // 落地即记一条漏斗 land 事件
    await this.prisma.funnelEvent.create({ data: { channel, ref, stage: 'land' } });

    return {
      id: a.id,
      channel: a.channel,
      source: a.source,
      externalId: a.externalId,
      startParam: a.startParam,
      ref: a.ref,
      campaign: a.campaign,
      verified: a.verified,
      createdAt: a.createdAt.toISOString(),
    };
  }

  async recordEvent(body: CreateFunnelEventDto): Promise<{ ok: true }> {
    const channel = channelFromSource(body.channel ?? body.source);
    await this.prisma.funnelEvent.create({
      data: { channel, ref: body.ref ?? null, stage: body.stage, userId: body.userId ?? null },
    });
    return { ok: true };
  }

  countBySource(channel: string): Promise<number> {
    return this.prisma.funnelEvent.count({ where: { channel, stage: 'land' } });
  }

  async funnel(): Promise<FunnelDto> {
    const rows = await this.prisma.funnelEvent.groupBy({
      by: ['channel', 'stage'],
      _count: { _all: true },
    });
    const byChannel = new Map<string, Record<FunnelStage, number>>();
    for (const r of rows) {
      const m = byChannel.get(r.channel) ?? { land: 0, signup: 0, activate: 0 };
      if ((FUNNEL_STAGES as readonly string[]).includes(r.stage)) {
        m[r.stage as FunnelStage] = r._count._all;
      }
      byChannel.set(r.channel, m);
    }
    const channels = [...byChannel.entries()]
      .map(([channel, s]) => ({
        channel,
        land: s.land,
        signup: s.signup,
        activate: s.activate,
        signupRate: s.land ? +(s.signup / s.land).toFixed(3) : 0,
        activateRate: s.signup ? +(s.activate / s.signup).toFixed(3) : 0,
      }))
      .sort((a, b) => b.land - a.land);
    return { channels };
  }
}
