import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { PresenceService } from './presence.service';
import { HeartbeatDto } from './dto/heartbeat.dto';

@Controller('presence')
@UseGuards(JwtAuthGuard)
export class PresenceController {
  constructor(private presence: PresenceService) {}

  @Post('heartbeat')
  @HttpCode(204)
  async heartbeat(@CurrentUser() u: AuthUser, @Body() body: HeartbeatDto) {
    await this.presence.heartbeat(u.userId, body.availableForCall ?? true);
  }
}
