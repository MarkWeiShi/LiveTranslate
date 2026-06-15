import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import type { CallSession as PrismaCall } from '@prisma/client';
import {
  RING_TIMEOUT_MS,
  WS_EVENTS,
  type CallMode,
  type CallSessionDto,
  type CreateCallResponse,
  type EndCallResponse,
} from '@linku/shared';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { PresenceService } from '../presence/presence.service';
import { BlocksService } from '../safety/blocks.service';
import { MEDIA_TRANSPORT } from '../config/provider.tokens';
import type { MediaTransport } from '../adapters/media/media-transport.interface';
import { RealtimeEmitter } from '../realtime/realtime.emitter';
import { TranslationSessionService } from '../translation/translation-session.service';

@Injectable()
export class CallsService {
  private ringTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private prisma: PrismaService,
    private users: UsersService,
    private presence: PresenceService,
    private blocks: BlocksService,
    @Inject(MEDIA_TRANSPORT) private media: MediaTransport,
    private emitter: RealtimeEmitter,
    @Inject(forwardRef(() => TranslationSessionService))
    private translation: TranslationSessionService,
  ) {}

  // ---- create / invite ----
  async create(
    callerId: string,
    calleeId: string,
    mode: CallMode,
  ): Promise<CreateCallResponse> {
    if (callerId === calleeId)
      throw new ForbiddenException({ code: 'CANNOT_CALL_SELF', message: 'Cannot call yourself' });
    await this.users.getEntity(calleeId); // 404 if missing

    if (await this.blocks.isBlockedEither(callerId, calleeId))
      throw new ForbiddenException({ code: 'BLOCKED', message: 'Call not allowed between blocked users' });

    if (!(await this.presence.isAvailable(calleeId)))
      throw new ConflictException({ code: 'CALLEE_UNAVAILABLE', message: 'Callee is offline or unavailable' });

    const existing = await this.prisma.callSession.findFirst({
      where: {
        status: { in: ['RINGING', 'ACTIVE'] },
        OR: [{ callerId }, { calleeId: callerId }],
      },
    });
    if (existing)
      throw new ConflictException({ code: 'ALREADY_IN_CALL', message: 'You are already in a call' });

    const call = await this.prisma.callSession.create({
      data: { callerId, calleeId, mode, status: 'RINGING' },
    });
    const { room } = await this.media.createRoom(call.id);
    const callerToken = await this.media.mintToken(callerId, room);
    const callerCard = await this.users.getCard(callerId);
    const calleeCard = await this.users.getCard(calleeId);

    this.emitter.emitToUser(calleeId, WS_EVENTS.INCOMING_CALL, {
      callId: call.id,
      caller: callerCard,
      mode,
      room,
    });

    // ring timeout -> MISSED
    const t = setTimeout(() => void this.expireRing(call.id), RING_TIMEOUT_MS);
    if (typeof t.unref === 'function') t.unref();
    this.ringTimers.set(call.id, t);

    return { callId: call.id, livekitToken: callerToken, room, callee: calleeCard };
  }

  private clearRing(callId: string) {
    const t = this.ringTimers.get(callId);
    if (t) {
      clearTimeout(t);
      this.ringTimers.delete(callId);
    }
  }

  private async expireRing(callId: string) {
    this.ringTimers.delete(callId);
    const call = await this.prisma.callSession.findUnique({ where: { id: callId } });
    if (!call || call.status !== 'RINGING') return;
    await this.prisma.callSession.update({
      where: { id: callId },
      data: { status: 'MISSED', endedAt: new Date() },
    });
    this.emitter.emitToUsers([call.callerId, call.calleeId], WS_EVENTS.CALL_ENDED, {
      callId,
      reason: 'missed',
      durationSec: 0,
      translatedSec: 0,
    });
  }

  // ---- accept ----
  async accept(callId: string, userId: string): Promise<{ livekitToken: string; room: string }> {
    const call = await this.mustGet(callId);
    if (call.calleeId !== userId)
      throw new ForbiddenException({ code: 'NOT_CALLEE', message: 'Only the callee can accept' });
    if (call.status !== 'RINGING')
      throw new ConflictException({ code: 'NOT_RINGING', message: `Call is ${call.status}` });

    this.clearRing(callId);
    await this.prisma.callSession.update({
      where: { id: callId },
      data: { status: 'ACTIVE', startedAt: new Date() },
    });
    const { room } = await this.media.createRoom(callId);
    const token = await this.media.mintToken(userId, room);

    this.emitter.emitToUser(call.callerId, WS_EVENTS.CALL_ACCEPTED, { callId, room });

    // Start the translation session (server is the sole billing accountant).
    if (call.translationOn) {
      await this.translation.start(callId);
    }
    return { livekitToken: token, room };
  }

  // ---- decline ----
  async decline(callId: string, userId: string): Promise<void> {
    const call = await this.mustGet(callId);
    if (call.calleeId !== userId)
      throw new ForbiddenException({ code: 'NOT_CALLEE', message: 'Only the callee can decline' });
    if (call.status !== 'RINGING')
      throw new ConflictException({ code: 'NOT_RINGING', message: `Call is ${call.status}` });
    this.clearRing(callId);
    await this.prisma.callSession.update({ where: { id: callId }, data: { status: 'DECLINED', endedAt: new Date() } });
    this.emitter.emitToUser(call.callerId, WS_EVENTS.CALL_DECLINED, { callId, reason: 'declined' });
  }

  // ---- end / hangup ----
  async end(callId: string, userId: string, reason?: string): Promise<EndCallResponse> {
    const call = await this.mustGet(callId);
    if (call.callerId !== userId && call.calleeId !== userId)
      throw new ForbiddenException({ code: 'NOT_PARTICIPANT', message: 'Not a participant' });
    if (call.status === 'ENDED' || call.status === 'DECLINED' || call.status === 'MISSED') {
      return { durationSec: call.durationSec, translatedSec: call.translatedSec };
    }
    this.clearRing(callId);
    // stop translation + capture final translatedSec
    const translatedSec = await this.translation.stop(callId);
    const endedAt = new Date();
    const durationSec = call.startedAt
      ? Math.max(0, Math.round((endedAt.getTime() - call.startedAt.getTime()) / 1000))
      : 0;
    const finalTranslated = Math.max(translatedSec, call.translatedSec);
    await this.prisma.callSession.update({
      where: { id: callId },
      data: { status: 'ENDED', endedAt, durationSec, translatedSec: finalTranslated },
    });
    const peer = this.getPeerId(call, userId);
    this.emitter.emitToUsers([call.callerId, call.calleeId], WS_EVENTS.CALL_ENDED, {
      callId,
      reason: reason ?? 'hangup',
      durationSec,
      translatedSec: finalTranslated,
    });
    void peer;
    return { durationSec, translatedSec: finalTranslated };
  }

  // ---- translation toggle (delegated to TranslationSession) ----
  async toggleTranslation(callId: string, userId: string, on: boolean) {
    const call = await this.mustGet(callId);
    if (call.callerId !== userId && call.calleeId !== userId)
      throw new ForbiddenException({ code: 'NOT_PARTICIPANT', message: 'Not a participant' });
    await this.prisma.callSession.update({ where: { id: callId }, data: { translationOn: on } });
    return this.translation.toggle(callId, on);
  }

  // ---- history ----
  async history(userId: string): Promise<CallSessionDto[]> {
    const rows = await this.prisma.callSession.findMany({
      where: { OR: [{ callerId: userId }, { calleeId: userId }] },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return Promise.all(rows.map((c) => this.toDto(c, userId)));
  }

  // ---- disconnect cleanup ----
  async handleDisconnect(userId: string): Promise<void> {
    const call = await this.prisma.callSession.findFirst({
      where: { status: { in: ['RINGING', 'ACTIVE'] }, OR: [{ callerId: userId }, { calleeId: userId }] },
    });
    if (!call) return;
    if (call.status === 'RINGING' && call.calleeId === userId) {
      await this.decline(call.id, userId).catch(() => undefined);
    } else {
      await this.end(call.id, userId, 'disconnect').catch(() => undefined);
    }
  }

  // ---- helpers ----
  getPeerId(call: PrismaCall, userId: string): string {
    return call.callerId === userId ? call.calleeId : call.callerId;
  }

  async getEntity(callId: string): Promise<PrismaCall> {
    return this.mustGet(callId);
  }

  private async mustGet(callId: string): Promise<PrismaCall> {
    const call = await this.prisma.callSession.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException({ code: 'CALL_NOT_FOUND', message: 'Call not found' });
    return call;
  }

  private async toDto(c: PrismaCall, viewerId: string): Promise<CallSessionDto> {
    const peerId = this.getPeerId(c, viewerId);
    let peer;
    try {
      peer = await this.users.getCard(peerId);
    } catch {
      peer = undefined;
    }
    return {
      id: c.id,
      callerId: c.callerId,
      calleeId: c.calleeId,
      mode: c.mode as CallMode,
      status: c.status as CallSessionDto['status'],
      translationOn: c.translationOn,
      startedAt: c.startedAt ? c.startedAt.toISOString() : null,
      endedAt: c.endedAt ? c.endedAt.toISOString() : null,
      durationSec: c.durationSec,
      translatedSec: c.translatedSec,
      createdAt: c.createdAt.toISOString(),
      peer,
    };
  }
}
