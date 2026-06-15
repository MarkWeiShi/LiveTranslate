import { IsOptional, IsString } from 'class-validator';

export class HelloTalkCallbackDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  mockUserId?: string;
}
