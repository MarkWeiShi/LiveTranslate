import { IsIn, IsOptional, IsString } from 'class-validator';
import { REPORT_REASONS, type ReportReason } from '@linku/shared';

export class CreateReportDto {
  @IsString()
  targetId!: string;

  @IsOptional()
  @IsString()
  callId?: string;

  @IsIn(REPORT_REASONS as unknown as string[])
  reason!: ReportReason;

  @IsOptional()
  @IsString()
  detail?: string;
}
