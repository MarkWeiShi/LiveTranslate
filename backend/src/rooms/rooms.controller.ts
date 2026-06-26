import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { RoomsService } from './rooms.service';
import {
  BarrageDto,
  JoinRoomDto,
  QuizAnswerDto,
  TelephonePassDto,
  TelephoneStartDto,
  UtteranceDto,
} from './dto/room.dto';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(private rooms: RoomsService) {}

  @Post()
  create(@CurrentUser() u: AuthUser) {
    return this.rooms.create(u.userId);
  }

  @Post(':id/join')
  join(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: JoinRoomDto) {
    return this.rooms.join(id, u.userId, body.language);
  }

  @Post(':id/utterance')
  utterance(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: UtteranceDto) {
    return this.rooms.utterance(id, u.userId, body.text);
  }

  @Post(':id/leave')
  @HttpCode(204)
  leave(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    this.rooms.leave(id, u.userId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.rooms.get(id);
  }

  // ---- 玩法层 ----
  @Post(':id/barrage')
  barrage(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: BarrageDto) {
    return this.rooms.barrage(id, u.userId, body.text);
  }

  @Post(':id/raise-hand')
  raise(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.rooms.raiseHand(id, u.userId, true);
  }

  @Post(':id/lower-hand')
  lower(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.rooms.raiseHand(id, u.userId, false);
  }

  @Post(':id/telephone/start')
  telStart(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: TelephoneStartDto) {
    return this.rooms.telephoneStart(id, u.userId, body.text);
  }

  @Post(':id/telephone/pass')
  telPass(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: TelephonePassDto) {
    return this.rooms.telephonePass(id, u.userId, body.gameId, body.text);
  }

  @Post(':id/quiz/start')
  quizStart(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.rooms.quizStart(id, u.userId);
  }

  @Post(':id/quiz/answer')
  quizAnswer(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: QuizAnswerDto) {
    return this.rooms.quizAnswer(id, u.userId, body.questionId, body.choice);
  }
}
