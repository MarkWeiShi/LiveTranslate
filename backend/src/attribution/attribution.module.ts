import { Module } from '@nestjs/common';
import { AttributionService } from './attribution.service';
import { AttributionController } from './attribution.controller';

// 获客归因（Telegram 生态，M3 mock 阶段）。PrismaModule 为 @Global，无需 import。
@Module({
  providers: [AttributionService],
  controllers: [AttributionController],
  exports: [AttributionService],
})
export class AttributionModule {}
