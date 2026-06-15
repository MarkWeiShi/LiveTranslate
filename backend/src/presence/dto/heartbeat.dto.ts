import { IsBoolean, IsOptional } from 'class-validator';

export class HeartbeatDto {
  @IsOptional()
  @IsBoolean()
  availableForCall?: boolean = true;
}
