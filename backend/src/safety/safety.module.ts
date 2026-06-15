import { Module } from '@nestjs/common';
import { BlocksService } from './blocks.service';
import { ReportsService } from './reports.service';
import { RiskDetectionService } from './risk-detection.service';
import { SafetyController } from './safety.controller';

// Blocks + reports + risk detection (used by discovery/calls/translation).
@Module({
  providers: [BlocksService, ReportsService, RiskDetectionService],
  controllers: [SafetyController],
  exports: [BlocksService, RiskDetectionService],
})
export class SafetyModule {}
