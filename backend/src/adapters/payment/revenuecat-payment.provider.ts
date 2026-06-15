import { InternalServerErrorException } from '@nestjs/common';
import type {
  PaymentProvider,
  WalletGrant,
} from './payment-provider.interface';

/** Real RevenueCat verifier — stub. Real IAP receipts only validate in native store builds. */
export class RevenueCatPaymentProvider implements PaymentProvider {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async verify(_input: { receipt: string }): Promise<WalletGrant> {
    throw new InternalServerErrorException({
      code: 'REVENUECAT_NOT_CONFIGURED',
      message: 'RevenueCat not implemented in MVP. Set PAYMENT_PROVIDER=mock.',
    });
  }
}
