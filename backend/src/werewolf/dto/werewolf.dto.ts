import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import type { WolfActionType } from '@linku/shared';

export class WolfCreateDto {
  @IsOptional() @IsString() boardKey?: string;
  @IsOptional() @IsString() language?: string;
}

export class WolfJoinDto {
  @IsOptional() @IsString() language?: string;
}

export class WolfNightActionDto {
  @IsIn(['WOLF_KILL', 'SEER_CHECK', 'WITCH', 'HUNTER_SHOT']) action!: WolfActionType;
  @IsOptional() @IsInt() @Min(0) targetSeat?: number;
  @IsOptional() @IsBoolean() save?: boolean;
  @IsOptional() @IsInt() @Min(0) poisonSeat?: number;
}

export class WolfSpeakDto {
  @IsString() @MinLength(1) @MaxLength(500) text!: string;
}

export class WolfVoteDto {
  @IsOptional() @IsInt() @Min(0) targetSeat?: number | null;
}
