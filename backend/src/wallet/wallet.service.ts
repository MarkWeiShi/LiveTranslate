import { Inject, Injectable } from '@nestjs/common';
import { DEFAULT_TRIAL_SECONDS, type WalletDto } from '@linku/shared';
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
