import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { HelloTalkCallbackDto } from './dto/hellotalk-callback.dto';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('hellotalk/callback')
  callback(@Body() body: HelloTalkCallbackDto) {
    return this.auth.callback(body);
  }
}
