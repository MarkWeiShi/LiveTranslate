import { IsString } from 'class-validator';

export class TelegramAuthDto {
  @IsString() tgWebAppData!: string;
}
