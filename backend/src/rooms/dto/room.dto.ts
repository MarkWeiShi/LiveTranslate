import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class GiftDto {
  @IsString() @MinLength(1) @MaxLength(40) giftType!: string;
  @IsOptional() @IsString() toUserId?: string | null;
}

export class ApplyMicDto {
  @IsOptional() @IsInt() @Min(0) seatIndex?: number | null;
}

export class MicDecisionDto {
  @IsString() userId!: string;
  @IsOptional() @IsInt() @Min(0) seatIndex?: number | null;
}

export class SeatTargetDto {
  @IsInt() @Min(0) seatIndex!: number;
  @IsOptional() @IsBoolean() muted?: boolean;
}

export class SetMicModeDto {
  @IsIn(['free', 'approval']) mode!: 'free' | 'approval';
}

export class LockSeatDto {
  @IsInt() @Min(0) seatIndex!: number;
  @IsBoolean() locked!: boolean;
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
