import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ROOM_EVENTS,
  type CreateRoomResponse,
  type JoinRoomResponse,
  type QueueEntry,
  type RoomBarragePayload,
  type RoomCaptionPayload,
  type RoomDto,
  type RoomMemberDto,
  type TelephoneChainItem,
  type TelephoneResultPayload,
  type TelephoneTurnPayload,
  type QuizQuestionPayload,
  type QuizResultPayload,
  type QuizScore,
  type RoomGiftPayload,
} from '@linku/shared';
import { QUIZ_BANK, localizedQuestion } from './quiz-bank';
import { MEDIA_TRANSPORT, TRANSLATION_ENGINE } from '../config/provider.tokens';
import type { MediaTransport } from '../adapters/media/media-transport.interface';
import type { TranslationEngine } from '../adapters/translation/translation-engine.interface';
import { RealtimeEmitter } from '../realtime/realtime.emitter';
import { PrismaService } from '../prisma/prisma.service';

interface TelephoneState {
  gameId: string;
  order: string[]; // 成员 userId 链（join 顺序）
  idx: number; // 下一个等待传话的成员下标
  chain: TelephoneChainItem[];
}
interface QuizState {
  quizId: string;
  idx: number;
  answered: Set<string>;
  scores: Map<string, number>;
  solved: boolean; // 本题是否已有人答对（抢答）
}
interface RoomState {
  id: string;
  room: string; // media 房间名
  createdAt: Date;
  members: Map<string, RoomMemberDto>;
  queue: string[]; // 上麦排队（userId，FIFO）
  telephone: TelephoneState | null;
  quiz: QuizState | null;
}

@Injectable()
export class RoomsService {
  // MVP：房间在内存（无 DB）。N 人通用，先验证 2 人跨语言字幕。
  private rooms = new Map<string, RoomState>();

  constructor(
    @Inject(MEDIA_TRANSPORT) private media: MediaTransport,
    @Inject(TRANSLATION_ENGINE) private engine: TranslationEngine,
    private emitter: RealtimeEmitter,
    private prisma: PrismaService,
  ) {}

  async create(userId: string): Promise<CreateRoomResponse> {
    const id = randomUUID();
    const handle = await this.media.createRoom(id);
    this.rooms.set(id, {
      id,
      room: handle.room,
      createdAt: new Date(),
      members: new Map(),
      queue: [],
      telephone: null,
      quiz: null,
    });
    const token = await this.media.mintToken(userId, handle.room);
    return { roomId: id, room: handle.room, token };
  }

  async join(roomId: string, userId: string, language?: string): Promise<JoinRoomResponse> {
    const room = this.must(roomId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const member: RoomMemberDto = {
      userId,
      displayName: user?.displayName ?? userId,
      language: language ?? user?.nativeLanguage ?? 'en',
    };
    room.members.set(userId, member);

    // 通知房内其他成员有人加入
    const others = [...room.members.values()].filter((m) => m.userId !== userId).map((m) => m.userId);
    this.emitter.emitToUsers(others, ROOM_EVENTS.MEMBER_JOINED, { roomId, member });

    const token = await this.media.mintToken(userId, room.room);
    return { roomId, room: room.room, token, members: [...room.members.values()] };
  }

  /** 发言扇出：把发言者母语的一句话，翻成每个其他成员的母语并推送字幕（发言者本人不收）。 */
  async utterance(roomId: string, fromUserId: string, text: string): Promise<{ recipients: number }> {
    const room = this.must(roomId);
    const from = room.members.get(fromUserId);
    if (!from) throw new BadRequestException({ code: 'NOT_IN_ROOM' });

    const others = [...room.members.values()].filter((m) => m.userId !== fromUserId);
    for (const m of others) {
      const translatedText = await this.engine.translate(text, from.language, m.language);
      const payload: RoomCaptionPayload = {
        roomId,
        fromUserId,
        fromName: from.displayName,
        originalText: text,
        originalLang: from.language,
        translatedText,
        targetLang: m.language,
        ts: Date.now(),
      };
      this.emitter.emitToUser(m.userId, ROOM_EVENTS.CAPTION, payload);
    }
    return { recipients: others.length };
  }

  leave(roomId: string, userId: string): { ok: true } {
    const room = this.rooms.get(roomId);
    if (!room) return { ok: true };
    room.members.delete(userId);
    const others = [...room.members.values()].map((m) => m.userId);
    this.emitter.emitToUsers(others, ROOM_EVENTS.MEMBER_LEFT, { roomId, userId });
    if (room.members.size === 0) this.rooms.delete(roomId);
    return { ok: true };
  }

  get(roomId: string): RoomDto {
    const room = this.must(roomId);
    return { id: room.id, createdAt: room.createdAt.toISOString(), members: [...room.members.values()] };
  }

  // ---------- 玩法层 ----------

  /** 双语弹幕：翻成每个成员母语后扇给所有人（含发送者）。 */
  async barrage(roomId: string, fromUserId: string, text: string): Promise<{ recipients: number }> {
    const room = this.must(roomId);
    const from = room.members.get(fromUserId);
    if (!from) throw new BadRequestException({ code: 'NOT_IN_ROOM' });
    const all = [...room.members.values()];
    for (const m of all) {
      const translatedText = await this.engine.translate(text, from.language, m.language);
      const payload: RoomBarragePayload = {
        roomId, fromUserId, fromName: from.displayName,
        originalText: text, originalLang: from.language,
        translatedText, targetLang: m.language, ts: Date.now(),
      };
      this.emitter.emitToUser(m.userId, ROOM_EVENTS.BARRAGE, payload);
    }
    return { recipients: all.length };
  }

  /** 送礼：广播给全房（含发送者）→ 各端播放飘屏 + 累计魅力值。 */
  gift(roomId: string, fromUserId: string, giftType: string, coins: number, toUserId?: string | null): { ok: true } {
    const room = this.must(roomId);
    const from = room.members.get(fromUserId);
    if (!from) throw new BadRequestException({ code: 'NOT_IN_ROOM' });
    const payload: RoomGiftPayload = {
      roomId,
      fromUserId,
      fromName: from.displayName,
      giftType,
      coins,
      toUserId: toUserId ?? null,
      ts: Date.now(),
    };
    this.emitter.emitToUsers([...room.members.keys()], ROOM_EVENTS.GIFT, payload);
    return { ok: true };
  }

  /** 上麦排队：raise=入队，lower=出队；广播最新队列给全房。 */
  raiseHand(roomId: string, userId: string, up: boolean): { ok: true } {
    const room = this.must(roomId);
    if (!room.members.has(userId)) throw new BadRequestException({ code: 'NOT_IN_ROOM' });
    room.queue = room.queue.filter((id) => id !== userId);
    if (up) room.queue.push(userId);
    this.broadcastQueue(room);
    return { ok: true };
  }

  private broadcastQueue(room: RoomState) {
    const queue: QueueEntry[] = room.queue
      .map((id) => room.members.get(id))
      .filter((m): m is RoomMemberDto => !!m)
      .map((m) => ({ userId: m.userId, displayName: m.displayName }));
    const ids = [...room.members.keys()];
    this.emitter.emitToUsers(ids, ROOM_EVENTS.QUEUE_UPDATED, { roomId: room.id, queue });
  }

  /** 传话游戏：以 join 顺序成链，发起者出句 → 逐跳翻译派发。 */
  async telephoneStart(roomId: string, starterId: string, text: string): Promise<{ gameId: string }> {
    const room = this.must(roomId);
    const starter = room.members.get(starterId);
    if (!starter) throw new BadRequestException({ code: 'NOT_IN_ROOM' });
    const order = [...room.members.keys()];
    if (order.length < 2) throw new BadRequestException({ code: 'NEED_2_PLAYERS' });
    // 让发起者排在链首
    order.splice(order.indexOf(starterId), 1);
    order.unshift(starterId);

    const gameId = randomUUID();
    room.telephone = {
      gameId,
      order,
      idx: 1,
      chain: [{ userId: starterId, displayName: starter.displayName, lang: starter.language, text }],
    };
    await this.sendTelephoneTurn(room);
    return { gameId };
  }

  async telephonePass(roomId: string, userId: string, gameId: string, text: string): Promise<{ done: boolean }> {
    const room = this.must(roomId);
    const t = room.telephone;
    if (!t || t.gameId !== gameId) throw new BadRequestException({ code: 'NO_ACTIVE_GAME' });
    if (t.order[t.idx] !== userId) throw new BadRequestException({ code: 'NOT_YOUR_TURN' });
    const m = room.members.get(userId)!;
    t.chain.push({ userId, displayName: m.displayName, lang: m.language, text });
    t.idx += 1;

    if (t.idx < t.order.length) {
      await this.sendTelephoneTurn(room);
      return { done: false };
    }
    // 结束：广播链路对比
    const first = t.chain[0];
    const last = t.chain[t.chain.length - 1];
    const result: TelephoneResultPayload = {
      roomId, gameId,
      chain: t.chain,
      startText: first.text, startLang: first.lang,
      endText: last.text, endLang: last.lang,
    };
    this.emitter.emitToUsers([...room.members.keys()], ROOM_EVENTS.TELEPHONE_RESULT, result);
    room.telephone = null;
    return { done: true };
  }

  private async sendTelephoneTurn(room: RoomState) {
    const t = room.telephone!;
    const prev = t.chain[t.chain.length - 1];
    const toId = t.order[t.idx];
    const to = room.members.get(toId);
    if (!to) { room.telephone = null; return; }
    const heardText = await this.engine.translate(prev.text, prev.lang, to.language);
    const payload: TelephoneTurnPayload = {
      roomId: room.id, gameId: t.gameId, toUserId: toId,
      fromName: prev.displayName, heardText, heardLang: to.language, hop: t.idx,
    };
    this.emitter.emitToUser(toId, ROOM_EVENTS.TELEPHONE_TURN, payload);
  }

  /** 组队 PK 抢答：按各成员母语下发题目，先答对者得分。 */
  quizStart(roomId: string, starterId: string): { quizId: string } {
    const room = this.must(roomId);
    if (!room.members.has(starterId)) throw new BadRequestException({ code: 'NOT_IN_ROOM' });
    if (room.members.size < 2) throw new BadRequestException({ code: 'NEED_2_PLAYERS' });
    const quizId = randomUUID();
    room.quiz = {
      quizId,
      idx: 0,
      answered: new Set(),
      scores: new Map([...room.members.keys()].map((id) => [id, 0])),
      solved: false,
    };
    this.broadcastQuestion(room);
    return { quizId };
  }

  quizAnswer(roomId: string, userId: string, questionId: string, choice: number): { ok: true } {
    const room = this.must(roomId);
    const q = room.quiz;
    if (!q) throw new BadRequestException({ code: 'NO_ACTIVE_QUIZ' });
    const cur = QUIZ_BANK[q.idx];
    if (!cur || cur.id !== questionId) return { ok: true }; // 过期答案，忽略
    if (q.answered.has(userId)) return { ok: true };
    q.answered.add(userId);

    if (!q.solved && choice === cur.correct) {
      q.solved = true;
      q.scores.set(userId, (q.scores.get(userId) ?? 0) + 10);
      this.advanceQuiz(room);
    } else if (q.answered.size >= room.members.size) {
      this.advanceQuiz(room); // 全员答完仍无人对 → 进下一题
    }
    return { ok: true };
  }

  private advanceQuiz(room: RoomState) {
    const q = room.quiz!;
    q.idx += 1;
    q.answered.clear();
    q.solved = false;
    if (q.idx < QUIZ_BANK.length) {
      this.broadcastQuestion(room);
      return;
    }
    const scores: QuizScore[] = [...q.scores.entries()]
      .map(([userId, score]) => ({ userId, displayName: room.members.get(userId)?.displayName ?? userId, score }))
      .sort((a, b) => b.score - a.score);
    const winner = scores.length >= 2 && scores[0].score > scores[1].score ? scores[0] : null;
    const result: QuizResultPayload = { roomId: room.id, quizId: q.quizId, scores, winner };
    this.emitter.emitToUsers([...room.members.keys()], ROOM_EVENTS.QUIZ_RESULT, result);
    room.quiz = null;
  }

  private broadcastQuestion(room: RoomState) {
    const q = room.quiz!;
    const cur = QUIZ_BANK[q.idx];
    for (const m of room.members.values()) {
      const { prompt, options } = localizedQuestion(cur, m.language);
      const payload: QuizQuestionPayload = {
        roomId: room.id, quizId: q.quizId, questionId: cur.id,
        index: q.idx, total: QUIZ_BANK.length, prompt, options,
      };
      this.emitter.emitToUser(m.userId, ROOM_EVENTS.QUIZ_QUESTION, payload);
    }
  }

  private must(roomId: string): RoomState {
    const room = this.rooms.get(roomId);
    if (!room) throw new NotFoundException({ code: 'ROOM_NOT_FOUND' });
    return room;
  }
}
