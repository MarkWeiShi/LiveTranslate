import { IsIn, IsString } from 'class-validator';
import { CALL_MODES, type CallMode } from '@linku/shared';

export class CreateCallDto {
  @IsString()
  calleeId!: string;

  @IsIn(CALL_MODES as unknown as string[])
  mode!: CallMode;
}
