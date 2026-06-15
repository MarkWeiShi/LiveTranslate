import { BadRequestException } from '@nestjs/common';
import { MOCK_IAP_RECEIPTS } from '@linku/shared';
import type {
  PaymentProvider,
  WalletGrant,
} from './payment-provider.interface';

export class MockPaymentProvider implements PaymentProvider {
  async verify(input: { receipt: string }): Promise<WalletGrant> {
    const grant = MOCK_IAP_RECEIPTS[input.receipt];
    if (!grant) {
      throw new BadRequestException({
        code: 'UNKNOWN_RECEIPT',
        message: `Unknown receipt "${input.receipt}". Try: ${Object.keys(MOCK_IAP_RECEIPTS).join(', ')}`,
      });
    }
    return grant as WalletGrant;
  }
}
