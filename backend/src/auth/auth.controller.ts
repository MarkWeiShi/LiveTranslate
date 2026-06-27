import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { HelloTalkCallbackDto } from './dto/hellotalk-callback.dto';
import { TelegramAuthDto } from './dto/telegram-auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('hellotalk/callback')
  callback(@Body() body: HelloTalkCallbackDto) {
    return this.auth.callback(body);
  }

  // Telegram Mini App 自动登录
  @Post('telegram')
  telegram(@Body() body: TelegramAuthDto) {
    return this.auth.telegram(body.tgWebAppData);
  }
}
