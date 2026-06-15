import { IsString } from 'class-validator';

export class SendGiftDto {
  @IsString()
  giftType!: string;
}
