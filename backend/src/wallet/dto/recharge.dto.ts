import { IsInt, IsString, Min } from 'class-validator';

export class RechargeDto {
  @IsString() packId!: string;
}

export class WithdrawDto {
  @IsInt() @Min(1) amount!: number;
}
