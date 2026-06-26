import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { FUNNEL_STAGES, type FunnelStage } from '@linku/shared';

export class UtmDto {
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() medium?: string;
  @IsOptional() @IsString() campaign?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() term?: string;
  @IsOptional() @IsString() ref?: string;
}

export class CreateAttributionDto {
  /** Telegram WebApp.initData 原文；存在则按 telegram 归因（可校验） */
  @IsOptional() @IsString() tgWebAppData?: string;
  /** 渠道来源原文（x/twitter/messenger/ig/...） */
  @IsOptional() @IsString() source?: string;
  /** 外链 UTM 参数 */
  @IsOptional() @ValidateNested() @Type(() => UtmDto) utm?: UtmDto;
}

export class CreateFunnelEventDto {
  @IsOptional() @IsString() channel?: string;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() ref?: string;
  @IsIn(FUNNEL_STAGES as unknown as string[]) stage!: FunnelStage;
  @IsOptional() @IsString() userId?: string;
}
