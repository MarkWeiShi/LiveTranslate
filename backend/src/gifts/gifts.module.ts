import { Module } from '@nestjs/common';
import { GiftsService } from './gifts.service';
import { GiftsController } from './gifts.controller';
import { CallsModule } from '../calls/calls.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [CallsModule, WalletModule],
  providers: [GiftsService],
  controllers: [GiftsController],
})
export class GiftsModule {}
