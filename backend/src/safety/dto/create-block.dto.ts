import { IsString } from 'class-validator';

export class CreateBlockDto {
  @IsString()
  blockedUserId!: string;
}
