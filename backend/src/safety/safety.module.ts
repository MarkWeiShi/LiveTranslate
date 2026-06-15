import { Module } from '@nestjs/common';
import { BlocksService } from './blocks.service';
import { RiskDetectionService } from './risk-detection.service';
import { SafetyController } from './safety.controller';

// Blocks + risk detection (used by discovery/calls/translation). Reports endpoint added with controller.
@Module({
  providers: [BlocksService, RiskDetectionService],
  controllers: [SafetyController],
  exports: [BlocksService, RiskDetectionService],
})
export class SafetyModule {}
