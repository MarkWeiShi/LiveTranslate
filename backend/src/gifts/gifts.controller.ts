import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { GiftsService } from './gifts.service';
import { SendGiftDto } from './dto/send-gift.dto';

@Controller('calls')
@UseGuards(JwtAuthGuard)
export class GiftsController {
  constructor(private gifts: GiftsService) {}

  @Post(':id/gift')
  send(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: SendGiftDto) {
    return this.gifts.send(id, u.userId, body.giftType);
  }
}
