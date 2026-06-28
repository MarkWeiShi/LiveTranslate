import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { WalletModule } from '../wallet/wallet.module';

// 巴别塔语聊房（MVP）。adapters(MEDIA/TRANSLATION) + EmitterModule + PrismaModule 均 @Global。
// WalletModule 提供送礼扣费（WalletService）。
@Module({
  imports: [WalletModule],
  providers: [RoomsService],
  controllers: [RoomsController],
})
export class RoomsModule {}
