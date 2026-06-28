import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { WalletService } from './wallet.service';
import { IapVerifyDto } from './dto/iap-verify.dto';
import { RechargeDto, WithdrawDto } from './dto/recharge.dto';
import { answerPreCheckout } from './telegram-pay';

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

  /** 发起 Telegram Stars 充值（返回发票链接，前端 openInvoice）。无 Bot Token 时回退 mock。 */
  @Post('wallet/recharge')
  recharge(@CurrentUser() u: AuthUser, @Body() body: RechargeDto) {
    return this.wallet.recharge(u.userId, body.packId);
  }

  /** dev/非 Telegram：直接入账（演示/联调）。 */
  @Post('wallet/recharge/dev')
  rechargeDev(@CurrentUser() u: AuthUser, @Body() body: RechargeDto) {
    return this.wallet.devRecharge(u.userId, body.packId);
  }

  /** 提现收益（记录申请并从收益扣除）。 */
  @Post('wallet/withdraw')
  withdraw(@CurrentUser() u: AuthUser, @Body() body: WithdrawDto) {
    return this.wallet.withdraw(u.userId, body.amount);
  }
}

// Telegram 支付回调（无鉴权——由 Telegram 服务器调用）。需 setWebhook 指向 /telegram/webhook。
@Controller('telegram')
export class TelegramWebhookController {
  constructor(private wallet: WalletService) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(@Body() update: any): Promise<{ ok: true }> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    // 1) 必须 10s 内确认 pre_checkout
    if (update?.pre_checkout_query && token) {
      await answerPreCheckout(token, update.pre_checkout_query.id, true);
      return { ok: true };
    }
    // 2) 支付成功 → 入账
    const sp = update?.message?.successful_payment;
    if (sp?.invoice_payload) {
      await this.wallet.handleStarsPayment(sp.invoice_payload, sp.telegram_payment_charge_id ?? '');
    }
    return { ok: true };
  }
}
