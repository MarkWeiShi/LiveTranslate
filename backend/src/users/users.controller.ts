import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { BlocksService } from '../safety/blocks.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private users: UsersService,
    private blocks: BlocksService,
  ) {}

  @Get('users/me')
  me(@CurrentUser() u: AuthUser) {
    return this.users.getMe(u.userId);
  }

  @Patch('users/me')
  updateMe(@CurrentUser() u: AuthUser, @Body() body: UpdateMeDto) {
    return this.users.updateMe(u.userId, body);
  }

  @Get('users/:id')
  async getOne(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const card = await this.users.getCard(id);
    card.blocked =
      u.userId === id ? false : await this.blocks.isBlockedEither(u.userId, id);
    return card;
  }
}
