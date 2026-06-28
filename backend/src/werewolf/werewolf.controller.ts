import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { WerewolfService } from './werewolf.service';
import { WolfCreateDto, WolfGiftDto, WolfJoinDto, WolfNightActionDto, WolfSpeakDto, WolfVoteDto } from './dto/werewolf.dto';

@Controller('werewolf')
@UseGuards(JwtAuthGuard)
export class WerewolfController {
  constructor(private wolf: WerewolfService) {}

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() body: WolfCreateDto) {
    return this.wolf.create(u.userId, body.boardKey, body.language);
  }

  @Post(':id/join')
  join(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: WolfJoinDto) {
    return this.wolf.join(id, u.userId, body.language);
  }

  @Post(':id/start')
  start(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.wolf.start(id, u.userId);
  }

  @Post(':id/night-action')
  nightAction(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: WolfNightActionDto) {
    return this.wolf.nightAction(id, u.userId, body.action, {
      targetSeat: body.targetSeat,
      save: body.save,
      poisonSeat: body.poisonSeat,
    });
  }

  @Post(':id/speak')
  speak(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: WolfSpeakDto) {
    return this.wolf.speak(id, u.userId, body.text);
  }

  @Post(':id/pass')
  pass(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.wolf.pass(id, u.userId);
  }

  @Post(':id/vote')
  vote(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: WolfVoteDto) {
    return this.wolf.vote(id, u.userId, body.targetSeat ?? null);
  }

  @Post(':id/gift')
  gift(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: WolfGiftDto) {
    return this.wolf.gift(id, u.userId, body.giftType, body.toSeat);
  }

  @Post(':id/leave')
  @HttpCode(204)
  leave(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    this.wolf.leave(id, u.userId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.wolf.state(id);
  }
}
