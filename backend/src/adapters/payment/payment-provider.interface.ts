import type { SubTier } from '@linku/shared';

export interface WalletGrant {
  diamonds?: number;
  subscriptionTier?: Exclude<SubTier, 'NONE'>;
  subscriptionDurationDays?: number;
}

export interface PaymentProvider {
  verify(input: { receipt: string }): Promise<WalletGrant>;
}
