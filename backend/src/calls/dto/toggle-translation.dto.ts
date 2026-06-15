import { IsBoolean } from 'class-validator';

export class ToggleTranslationDto {
  @IsBoolean()
  on!: boolean;
}
