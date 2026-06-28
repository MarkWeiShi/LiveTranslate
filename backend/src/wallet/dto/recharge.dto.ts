import { IsString } from 'class-validator';

export class RechargeDto {
  @IsString() packId!: string;
}
