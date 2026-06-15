import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { WalletService } from './wallet.service';
import { IapVerifyDto } from './dto/iap-verify.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private wallet: WalletService) {}

  @Get('wallet')
  get(@CurrentUser() u: AuthUser) {
    return this.wallet.get(u.userId);
  }

  @Post('iap/verify')
  verify(@CurrentUser() u: AuthUser, @Body() body: IapVerifyDto) {
    return this.wallet.verifyIap(u.userId, body.receipt);
  }
}
