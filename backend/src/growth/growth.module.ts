import { Module } from '@nestjs/common';
import { GrowthService } from './growth.service';
import { GrowthController } from './growth.controller';

// 成长体系（积分/等级、CP 亲密度、家族战）。PrismaModule @Global，无需 import。
@Module({
  providers: [GrowthService],
  controllers: [GrowthController],
})
export class GrowthModule {}
