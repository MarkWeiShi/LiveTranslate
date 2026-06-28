import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController, TelegramWebhookController } from './wallet.controller';
import { TranslationModule } from '../translation/translation.module';

@Module({
  imports: [TranslationModule],
  providers: [WalletService],
  controllers: [WalletController, TelegramWebhookController],
  exports: [WalletService],
})
export class WalletModule {}
