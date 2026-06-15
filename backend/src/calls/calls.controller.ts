import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { CallsService } from './calls.service';
import { CreateCallDto } from './dto/create-call.dto';
import { EndCallDto } from './dto/end-call.dto';
import { ToggleTranslationDto } from './dto/toggle-translation.dto';

@Controller('calls')
@UseGuards(JwtAuthGuard)
export class CallsController {
  constructor(private calls: CallsService) {}

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() body: CreateCallDto) {
    return this.calls.create(u.userId, body.calleeId, body.mode);
  }

  @Post(':id/accept')
  accept(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.calls.accept(id, u.userId);
  }

  @Post(':id/decline')
  @HttpCode(204)
  async decline(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.calls.decline(id, u.userId);
  }

  @Post(':id/end')
  end(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: EndCallDto) {
    return this.calls.end(id, u.userId, body.reason);
  }

  @Post(':id/translation/toggle')
  toggle(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() body: ToggleTranslationDto,
  ) {
    return this.calls.toggleTranslation(id, u.userId, body.on);
  }

  @Get('history')
  history(@CurrentUser() u: AuthUser) {
    return this.calls.history(u.userId);
  }
}
