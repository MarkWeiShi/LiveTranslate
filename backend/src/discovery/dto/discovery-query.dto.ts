import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { GENDERS, type Gender } from '@linku/shared';

export class DiscoveryQueryDto {
  @IsOptional()
  @IsString()
  lang?: string;

  @IsOptional()
  @IsIn(GENDERS as unknown as string[])
  gender?: Gender;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  onlineOnly?: boolean;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(0)
  page?: number = 0;
}
