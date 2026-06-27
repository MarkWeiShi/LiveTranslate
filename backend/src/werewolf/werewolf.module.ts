import { Module } from '@nestjs/common';
import { WerewolfService } from './werewolf.service';
import { WerewolfController } from './werewolf.controller';

// 跨语言狼人杀（MVP）。adapters(MEDIA/TRANSLATION) + EmitterModule + PrismaModule 均 @Global，无需 import。
@Module({
  providers: [WerewolfService],
  controllers: [WerewolfController],
})
export class WerewolfModule {}
