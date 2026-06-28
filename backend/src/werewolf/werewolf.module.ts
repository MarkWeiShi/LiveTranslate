import { Module } from '@nestjs/common';
import { WerewolfService } from './werewolf.service';
import { WerewolfController } from './werewolf.controller';
import { WalletModule } from '../wallet/wallet.module';

// 跨语言狼人杀（MVP）。adapters(MEDIA/TRANSLATION) + EmitterModule + PrismaModule 均 @Global。
// WalletModule 提供送礼扣费/收益（复用语聊房礼物经济）。
@Module({
  imports: [WalletModule],
  providers: [WerewolfService],
  controllers: [WerewolfController],
})
export class WerewolfModule {}
