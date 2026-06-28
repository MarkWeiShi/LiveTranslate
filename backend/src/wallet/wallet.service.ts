import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { DEFAULT_TRIAL_SECONDS, STAR_PACKS, type WalletDto, type RechargeResponse } from '@linku/shared';
import { createStarsInvoiceLink } from './telegram-pay';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER } from '../config/provider.tokens';
import type {
  PaymentProvider,
  WalletGrant,
} from '../adapters/payment/payment-provider.interface';
import { toWalletDto } from '../users/users.mapper';
import { TranslationSessionService } from '../translation/translation-session.service';

@Injectable()
export class WalletService {
  constructor(
    private prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private payments: PaymentProvider,
    private translation: TranslationSessionService,
  ) {}

  async getOrCreate(userId: string) {
    let w = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!w) w = await this.prisma.wallet.create({ data: { userId, trialSecondsLeft: DEFAULT_TRIAL_SECONDS } });
    // lazily expire subscription
    if (w.subscriptionTier !== 'NONE' && w.subscriptionExpiry && w.subscriptionExpiry.getTime() <= Date.now()) {
      w = await this.prisma.wallet.update({
        where: { userId },
        data: { subscriptionTier: 'NONE', subscriptionExpiry: null },
      });
    }
    return w;
  }

  async get(userId: string): Promise<WalletDto> {
    return toWalletDto(await this.getOrCreate(userId));
  }

  async verifyIap(userId: string, receipt: string): Promise<WalletDto> {
    const grant = await this.payments.verify({ receipt });
    const updated = await this.applyGrant(userId, grant);
    // resume a paywalled active call for this buyer (AC-PAY-2)
    await this.translation.resumeAfterPurchase(userId);
    return toWalletDto(updated);
  }

  private async applyGrant(userId: string, grant: WalletGrant) {
    await this.getOrCreate(userId);
    const data: Record<string, unknown> = {};
    if (grant.diamonds) data.diamonds = { increment: grant.diamonds };
    if (grant.subscriptionTier) {
      data.subscriptionTier = grant.subscriptionTier;
      const days = grant.subscriptionDurationDays ?? 30;
      data.subscriptionExpiry = new Date(Date.now() + days * 86_400_000);
    }
    return this.prisma.wallet.update({ where: { userId }, data });
  }

  /** 收礼收益入账（受赠方）。 */
  async creditEarnings(userId: string, amount: number): Promise<void> {
    if (amount <= 0) return;
    await this.getOrCreate(userId);
    await this.prisma.wallet.update({ where: { userId }, data: { earnings: { increment: amount } } });
  }

  /** 提现：从收益扣除并记录申请（PENDING）。 */
  async withdraw(userId: string, amount: number): Promise<WalletDto> {
    if (!Number.isInteger(amount) || amount <= 0) throw new BadRequestException({ code: 'BAD_AMOUNT' });
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const w = await tx.wallet.findUnique({ where: { userId } });
        if (!w || w.earnings < amount) {
          const err = new Error('Insufficient earnings') as Error & { code?: string };
          err.code = 'INSUFFICIENT_EARNINGS';
          throw err;
        }
        await tx.withdrawal.create({ data: { userId, amount, status: 'PENDING' } });
        return tx.wallet.update({ where: { userId }, data: { earnings: { decrement: amount } } });
      });
      return toWalletDto(updated);
    } catch (e) {
      if ((e as { code?: string })?.code === 'INSUFFICIENT_EARNINGS') {
        throw new BadRequestException({ code: 'INSUFFICIENT_EARNINGS', message: '收益不足' });
      }
      throw e;
    }
  }

  /** 充值入账钻石（Stars 支付成功 / dev mock）。 */
  async creditDiamonds(userId: string, diamonds: number): Promise<WalletDto> {
    await this.getOrCreate(userId);
    const w = await this.prisma.wallet.update({ where: { userId }, data: { diamonds: { increment: diamonds } } });
    return toWalletDto(w);
  }

  /** 发起充值：有 Bot Token → 返回 Telegram Stars 发票链接；否则回退 mock。 */
  async recharge(userId: string, packId: string): Promise<RechargeResponse> {
    const pack = STAR_PACKS.find((p) => p.id === packId);
    if (!pack) throw new BadRequestException({ code: 'BAD_PACK' });
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return { mode: 'mock' };
    const payload = JSON.stringify({ u: userId, d: pack.diamonds, p: pack.id });
    const invoiceLink = await createStarsInvoiceLink(token, {
      title: `${pack.diamonds} 钻石`,
      description: 'LinkU 语聊房钻石充值',
      payload,
      prices: [{ label: pack.label, amount: pack.stars }],
    });
    return { mode: 'stars', invoiceLink };
  }

  /** dev / 非 Telegram 环境：直接按充值包入账（仅演示/联调用）。 */
  async devRecharge(userId: string, packId: string): Promise<WalletDto> {
    const pack = STAR_PACKS.find((p) => p.id === packId);
    if (!pack) throw new BadRequestException({ code: 'BAD_PACK' });
    return this.creditDiamonds(userId, pack.diamonds);
  }

  /** Stars 支付成功回调入账（幂等：按 telegram_payment_charge_id 去重）。 */
  private processedCharges = new Set<string>();
  async handleStarsPayment(payloadStr: string, chargeId: string): Promise<void> {
    if (chargeId && this.processedCharges.has(chargeId)) return;
    let parsed: { u?: string; d?: number };
    try { parsed = JSON.parse(payloadStr); } catch { return; }
    if (!parsed.u || !parsed.d) return;
    await this.creditDiamonds(parsed.u, parsed.d);
    if (chargeId) this.processedCharges.add(chargeId);
    new Logger('WalletService').log(`Stars 入账 ${parsed.d}💎 → ${parsed.u} (charge ${chargeId})`);
  }

  /** Atomic diamond deduction for gifts; throws if insufficient. */
  async deductDiamonds(userId: string, amount: number) {
    return this.prisma.$transaction(async (tx) => {
      const w = await tx.wallet.findUnique({ where: { userId } });
      if (!w || w.diamonds < amount) {
        const err: any = new Error('Insufficient diamonds');
        err.code = 'INSUFFICIENT_DIAMONDS';
        throw err;
      }
      return tx.wallet.update({ where: { userId }, data: { diamonds: { decrement: amount } } });
    });
  }
}
