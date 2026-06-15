import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { GIFT_CATALOG, WS_EVENTS, type SendGiftResponse } from '@linku/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CallsService } from '../calls/calls.service';
import { WalletService } from '../wallet/wallet.service';
import { RealtimeEmitter } from '../realtime/realtime.emitter';
import { toWalletDto } from '../users/users.mapper';

@Injectable()
export class GiftsService {
  constructor(
    private prisma: PrismaService,
    private calls: CallsService,
    private wallet: WalletService,
    private emitter: RealtimeEmitter,
  ) {}

  async send(callId: string, fromId: string, giftType: string): Promise<SendGiftResponse> {
    const price = GIFT_CATALOG[giftType];
    if (price == null)
      throw new BadRequestException({ code: 'UNKNOWN_GIFT', message: `Unknown gift "${giftType}"` });

    const call = await this.calls.getEntity(callId);
    if (call.status !== 'ACTIVE')
      throw new BadRequestException({ code: 'CALL_NOT_ACTIVE', message: 'Call is not active' });
    if (call.callerId !== fromId && call.calleeId !== fromId)
      throw new ForbiddenException({ code: 'NOT_PARTICIPANT', message: 'Not a participant' });

    const toId = this.calls.getPeerId(call, fromId);

    let updatedWallet;
    try {
      updatedWallet = await this.wallet.deductDiamonds(fromId, price);
    } catch (e: any) {
      if (e?.code === 'INSUFFICIENT_DIAMONDS')
        throw new HttpException(
          { code: 'INSUFFICIENT_DIAMONDS', message: 'Not enough diamonds' },
          HttpStatus.PAYMENT_REQUIRED,
        );
      throw e;
    }

    const gift = await this.prisma.gift.create({
      data: { callId, fromId, toId, giftType, diamonds: price },
    });

    this.emitter.emitToUser(toId, WS_EVENTS.GIFT_RECEIVED, { callId, fromId, giftType });

    return {
      wallet: toWalletDto(updatedWallet),
      gift: {
        id: gift.id,
        callId: gift.callId,
        fromId: gift.fromId,
        toId: gift.toId,
        giftType: gift.giftType,
        diamonds: gift.diamonds,
        createdAt: gift.createdAt.toISOString(),
      },
    };
  }
}
