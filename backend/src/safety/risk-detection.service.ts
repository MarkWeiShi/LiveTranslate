import { Injectable } from '@nestjs/common';
import {
  RISK_HIGH_THRESHOLD,
  RISK_RULES,
  WS_EVENTS,
  type CaptionPayload,
} from '@linku/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEmitter } from '../realtime/realtime.emitter';

@Injectable()
export class RiskDetectionService {
  constructor(
    private prisma: PrismaService,
    private emitter: RealtimeEmitter,
  ) {}

  /** Scans translated + original caption text for scam/induced-fraud phrases (BuildSpec §6). */
  async scanCaption(
    callId: string,
    participantIds: string[],
    caption: CaptionPayload,
  ): Promise<void> {
    const text = `${caption.translatedText} ${caption.originalText}`;
    for (const rule of RISK_RULES) {
      const m = text.match(rule.pattern);
      if (!m) continue;
      await this.prisma.riskEvent.create({
        data: {
          userId: caption.speakerId,
          callId,
          type: rule.type,
          score: rule.score,
          snippet: m[0]?.slice(0, 120) ?? null,
        },
      });
      this.emitter.emitToUsers(participantIds, WS_EVENTS.RISK_WARNING, {
        callId,
        level: rule.score >= RISK_HIGH_THRESHOLD ? 'high' : 'medium',
        riskType: rule.type,
        message:
          rule.type === 'crypto_investment'
            ? '⚠️ 谨防杀猪盘：对方提到投资/加密货币，切勿转账。'
            : rule.type === 'money_transfer'
              ? '⚠️ 谨防诈骗：涉及转账/汇款，请提高警惕。'
              : '⚠️ 注意安全：对方索要外部联系方式，请谨慎。',
      });
      return; // one warning per caption is enough
    }
  }
}
