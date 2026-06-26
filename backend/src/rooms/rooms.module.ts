import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';

// 巴别塔语聊房（MVP）。adapters(MEDIA/TRANSLATION) + EmitterModule + PrismaModule 均 @Global，无需 import。
@Module({
  providers: [RoomsService],
  controllers: [RoomsController],
})
export class RoomsModule {}
