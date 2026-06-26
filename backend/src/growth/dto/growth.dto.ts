import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class AwardXpDto {
  @IsInt() @Min(1) @Max(1000) amount!: number;
  @IsOptional() @IsString() reason?: string;
}

export class BondDtoIn {
  @IsString() peerId!: string;
  @IsOptional() @IsInt() @Min(1) @Max(1000) amount?: number;
}

export class CreateFamilyDto {
  @IsString() @MinLength(1) @MaxLength(40) name!: string;
}

export class ContributeDto {
  @IsInt() @Min(1) @Max(100000) amount!: number;
}
