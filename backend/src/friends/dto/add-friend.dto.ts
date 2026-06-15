import { IsString } from 'class-validator';

export class AddFriendDto {
  @IsString()
  friendId!: string;
}
