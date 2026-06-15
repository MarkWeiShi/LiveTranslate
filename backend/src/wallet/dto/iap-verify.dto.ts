import { IsString } from 'class-validator';

export class IapVerifyDto {
  @IsString()
  receipt!: string;
}
