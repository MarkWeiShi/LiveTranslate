import { IsOptional, IsString } from 'class-validator';

export class EndCallDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
