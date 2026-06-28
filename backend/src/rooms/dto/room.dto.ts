import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class GiftDto {
  @IsString() @MinLength(1) @MaxLength(40) giftType!: string;
  @IsInt() @Min(0) coins!: number;
  @IsOptional() @IsString() toUserId?: string | null;
}

export class JoinRoomDto {
  @IsOptional() @IsString() language?: string;
}

export class UtteranceDto {
  @IsString() @MinLength(1) @MaxLength(500) text!: string;
}

export class BarrageDto {
  @IsString() @MinLength(1) @MaxLength(120) text!: string;
}

export class TelephoneStartDto {
  @IsString() @MinLength(1) @MaxLength(200) text!: string;
}

export class TelephonePassDto {
  @IsString() gameId!: string;
  @IsString() @MinLength(1) @MaxLength(200) text!: string;
}

export class QuizAnswerDto {
  @IsString() questionId!: string;
  @IsInt() @Min(0) choice!: number;
}
