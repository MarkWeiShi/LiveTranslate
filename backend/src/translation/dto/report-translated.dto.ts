import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ReportTranslatedDto {
  @IsString()
  callId!: string;

  @IsString()
  speakerId!: string;

  @IsInt()
  @Min(0)
  seconds!: number;

  @IsOptional()
  @IsString()
  originalText?: string;

  @IsOptional()
  @IsString()
  translatedText?: string;

  @IsOptional()
  @IsIn(['active', 'degraded'])
  state?: 'active' | 'degraded';
}
