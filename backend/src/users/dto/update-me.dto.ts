import { IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { INTENTS, type Intent } from '@linku/shared';

export class UpdateMeDto {
  @IsOptional()
  @IsIn(INTENTS as unknown as string[])
  intent?: Intent;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsString()
  nativeLanguage?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  learningLanguages?: string[];
}
