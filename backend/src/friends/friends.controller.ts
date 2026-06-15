import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { FriendsService } from './friends.service';
import { AddFriendDto } from './dto/add-friend.dto';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private friends: FriendsService) {}

  @Get()
  list(@CurrentUser() u: AuthUser) {
    return this.friends.list(u.userId);
  }

  @Post()
  add(@CurrentUser() u: AuthUser, @Body() body: AddFriendDto) {
    return this.friends.add(u.userId, body.friendId);
  }
}
