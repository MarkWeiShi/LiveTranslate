import { randomUUID } from 'node:crypto';
import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  WEREWOLF_EVENTS,
  WEREWOLF_BOARDS,
  type WolfRole,
  type WolfCamp,
  type WolfPhase,
  type WolfActionType,
  type WolfStatePayload,
  type WolfRolePayload,
  type WolfPrivatePayload,
  type WolfHostPayload,
  type WolfSpeechPayload,
  type WolfGameOverPayload,
  type WolfSeatPublic,
  type WolfCreateResponse,
  type WolfJoinResponse,
  type WolfFxType,
  type WolfFxPayload,
  type WolfGiftPayload,
  ROOM_GIFT_PRICE,
  GIFT_EARN_RATE,
} from '@linku/shared';
import { MEDIA_TRANSPORT, TRANSLATION_ENGINE } from '../config/provider.tokens';
import type { MediaTransport } from '../adapters/media/media-transport.interface';
import type { TranslationEngine } from '../adapters/translation/translation-engine.interface';
import { RealtimeEmitter } from '../realtime/realtime.emitter';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { ROLE_CAMP, roleText, host, notice, aiLine, type HostKey } from './roles';

// 阶段时长（ms）。纯 AI 步骤瞬时结算（无真人需等待）。
const T = {
  WOLF: 25_000,
  SEER: 20_000,
  WITCH: 20_000,
  HUNTER: 15_000,
  SPEAK: 45_000, // 每位发言者上限
  VOTE: 25_000,
  AI_SPEAK_DELAY: 1_200, // AI 发言后停顿再过麦
  DAWN_PAUSE: 2_500,
} as const;

interface Seat {
  seatNo: number;
  userId: string | null;
  displayName: string;
  language: string;
  isAI: boolean;
  role: WolfRole;
  alive: boolean;
  // 女巫药剂
  antidoteUsed: boolean;
  poisonUsed: boolean;
}

interface NightState {
  wolfVotes: Map<number, number>; // 狼座 -> 目标座
  victimSeat: number | null; // 狼刀结果
  witchSave: boolean;
  witchPoisonSeat: number | null;
}

interface Game {
  id: string;
  room: string;
  boardKey: string;
  hostUserId: string;
  phase: WolfPhase;
  day: number;
  started: boolean;
  containsAI: boolean;
  seats: Seat[];
  // 发言
  speakOrder: number[];
  speakIdx: number;
  speakDeadline: number | null;
  // 投票
  votes: Map<number, number | null>; // 投票者座 -> 目标座|null（弃票）
  voteDeadline: number | null;
  // 当前 step 的等待控制
  stepResolve: (() => void) | null;
  timer: ReturnType<typeof setTimeout> | null;
  night: NightState;
  pendingHunterSeat: number | null;
  aborted: boolean;
}

@Injectable()
export class WerewolfService {
  private games = new Map<string, Game>();
  private userGame = new Map<string, string>(); // userId -> gameId

  constructor(
    @Inject(MEDIA_TRANSPORT) private media: MediaTransport,
    @Inject(TRANSLATION_ENGINE) private engine: TranslationEngine,
    private emitter: RealtimeEmitter,
    private prisma: PrismaService,
    private wallet: WalletService,
  ) {}

  // ---------------- 送礼（复用语聊房礼物经济）----------------

  /** 送礼：服务端定价 → 扣发送者钻石（不足 402）→ 受赠方收益入账 → 广播全场飘屏。 */
  async gift(gameId: string, fromUserId: string, giftType: string, toSeat?: number | null): Promise<{ ok: true; balance: number }> {
    const game = this.must(gameId);
    const from = this.seatOf(game, fromUserId);
    if (!from) throw new BadRequestException({ code: 'NOT_IN_GAME' });
    const coins = ROOM_GIFT_PRICE[giftType];
    if (coins == null) throw new BadRequestException({ code: 'UNKNOWN_GIFT' });

    let balance: number;
    try {
      const w = await this.wallet.deductDiamonds(fromUserId, coins);
      balance = w.diamonds;
    } catch (e) {
      if ((e as { code?: string })?.code === 'INSUFFICIENT_DIAMONDS') {
        throw new HttpException({ code: 'INSUFFICIENT_DIAMONDS', message: '钻石不足，请充值' }, HttpStatus.PAYMENT_REQUIRED);
      }
      throw e;
    }

    const seat = typeof toSeat === 'number' ? game.seats[toSeat] : null;
    const toUserId = seat?.userId ?? null;
    if (toUserId && toUserId !== fromUserId) {
      await this.wallet.creditEarnings(toUserId, Math.floor(coins * GIFT_EARN_RATE));
    }

    const payload: WolfGiftPayload = {
      gameId,
      fromUserId,
      fromName: from.displayName,
      giftType,
      coins,
      toSeat: typeof toSeat === 'number' ? toSeat : null,
      toUserId,
      ts: Date.now(),
    };
    this.emitToAll(game, WEREWOLF_EVENTS.GIFT, payload);
    return { ok: true, balance };
  }

  // ---------------- 大厅 / 加入 ----------------

  async create(userId: string, boardKey = 'newbie6', language?: string): Promise<WolfCreateResponse> {
    const board = WEREWOLF_BOARDS[boardKey];
    if (!board) throw new BadRequestException({ code: 'BAD_BOARD' });
    const id = randomUUID();
    const handle = await this.media.createRoom(id);
    const game: Game = {
      id,
      room: handle.room,
      boardKey,
      hostUserId: userId,
      phase: 'lobby',
      day: 0,
      started: false,
      containsAI: false,
      seats: [],
      speakOrder: [],
      speakIdx: 0,
      speakDeadline: null,
      votes: new Map(),
      voteDeadline: null,
      stepResolve: null,
      timer: null,
      night: this.freshNight(),
      pendingHunterSeat: null,
      aborted: false,
    };
    this.games.set(id, game);
    await this.seatUser(game, userId, language);
    const token = await this.media.mintToken(userId, handle.room);
    return { gameId: id, room: handle.room, token, boardKey };
  }

  async join(gameId: string, userId: string, language?: string): Promise<WolfJoinResponse> {
    const game = this.must(gameId);
    if (game.started) throw new BadRequestException({ code: 'ALREADY_STARTED' });
    const board = WEREWOLF_BOARDS[game.boardKey];
    if (game.seats.filter((s) => s.userId).length >= board.size) {
      throw new BadRequestException({ code: 'ROOM_FULL' });
    }
    if (!game.seats.some((s) => s.userId === userId)) await this.seatUser(game, userId, language);
    this.broadcastState(game);
    const token = await this.media.mintToken(userId, game.room);
    return { gameId, room: game.room, token };
  }

  private async seatUser(game: Game, userId: string, language?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const seatNo = game.seats.length;
    game.seats.push({
      seatNo,
      userId,
      displayName: user?.displayName ?? `Player${seatNo + 1}`,
      language: language ?? user?.nativeLanguage ?? 'en',
      isAI: false,
      role: 'VILLAGER',
      alive: true,
      antidoteUsed: false,
      poisonUsed: false,
    });
    this.userGame.set(userId, game.id);
    this.broadcastState(game);
  }

  leave(gameId: string, userId: string): { ok: true } {
    const game = this.games.get(gameId);
    if (!game) return { ok: true };
    this.userGame.delete(userId);
    if (!game.started) {
      // 大厅阶段：移除座位（重排座号）
      game.seats = game.seats.filter((s) => s.userId !== userId).map((s, i) => ({ ...s, seatNo: i }));
      if (game.seats.every((s) => !s.userId)) this.destroy(game);
      else this.broadcastState(game);
      return { ok: true };
    }
    // 对局中：托管为 AI 顶替（保持牌局完整，PRD E2-7）
    const seat = game.seats.find((s) => s.userId === userId);
    if (seat) {
      seat.isAI = true;
      seat.userId = null;
      game.containsAI = true;
      this.broadcastState(game);
    }
    if (game.seats.every((s) => !s.userId)) this.destroy(game); // 没有真人了，结束
    return { ok: true };
  }

  // ---------------- 开局：补 AI、发牌、入夜 ----------------

  async start(gameId: string, userId: string): Promise<{ ok: true }> {
    const game = this.must(gameId);
    if (game.hostUserId !== userId) throw new BadRequestException({ code: 'NOT_HOST' });
    if (game.started) throw new BadRequestException({ code: 'ALREADY_STARTED' });
    const board = WEREWOLF_BOARDS[game.boardKey];

    // 冷启兜底：不足席位用 AI 玩家补满（PRD §5.4）
    const aiLangs = ['en', 'zh', 'es', 'ar'];
    while (game.seats.length < board.size) {
      const seatNo = game.seats.length;
      game.seats.push({
        seatNo,
        userId: null,
        displayName: `Bot-${seatNo + 1}`,
        language: aiLangs[seatNo % aiLangs.length],
        isAI: true,
        role: 'VILLAGER',
        alive: true,
        antidoteUsed: false,
        poisonUsed: false,
      });
    }
    game.containsAI = game.seats.some((s) => s.isAI);

    // 发牌：洗牌角色分配
    const roles = shuffle([...board.roles]);
    game.seats.forEach((s, i) => (s.role = roles[i]));
    game.started = true;
    game.phase = 'night';

    // 私密下发角色（仅本人，通道隔离 E7-1）
    for (const s of game.seats) this.sendRole(game, s);

    this.hostAll(game, 'game_start', { board: board.name, count: board.size });
    this.broadcastState(game);

    // 异步推进对局循环
    void this.runLoop(game);
    return { ok: true };
  }

  private sendRole(game: Game, seat: Seat) {
    if (!seat.userId) return;
    const camp = ROLE_CAMP[seat.role];
    const rt = roleText(seat.language, seat.role);
    const payload: WolfRolePayload = {
      gameId: game.id,
      seatNo: seat.seatNo,
      role: seat.role,
      camp,
      roleName: rt.name,
      roleDesc: rt.desc,
      teammates:
        seat.role === 'WOLF'
          ? game.seats
              .filter((x) => x.role === 'WOLF' && x.seatNo !== seat.seatNo)
              .map((x) => ({ seatNo: x.seatNo, displayName: x.displayName }))
          : undefined,
    };
    this.emitter.emitToUser(seat.userId, WEREWOLF_EVENTS.ROLE, payload);
  }

  // ---------------- 主循环 ----------------

  private async runLoop(game: Game) {
    try {
      while (!game.aborted) {
        await this.runNight(game);
        if (game.aborted) return;
        if (this.checkWin(game)) return;
        await this.runSpeak(game);
        if (game.aborted) return;
        await this.runVote(game);
        if (game.aborted) return;
        if (this.checkWin(game)) return;
      }
    } catch {
      this.destroy(game);
    }
  }

  // ---------------- 夜晚 ----------------

  private async runNight(game: Game) {
    game.day += 1;
    game.phase = 'night';
    game.night = this.freshNight();
    this.broadcastState(game);
    this.hostAll(game, 'night_fall', { day: game.day });

    await this.stepWolves(game);
    if (game.aborted) return;
    await this.stepSeer(game);
    if (game.aborted) return;
    await this.stepWitch(game);
    if (game.aborted) return;
    await this.resolveDawn(game);
  }

  private async stepWolves(game: Game) {
    const wolves = this.alive(game).filter((s) => s.role === 'WOLF');
    if (wolves.length === 0) return;
    const targets = this.alive(game).filter((s) => s.role !== 'WOLF');
    this.hostAll(game, 'wolves_wake');

    // AI 狼协同：统一目标，提高威胁
    const aiTarget = targets.length ? pick(targets).seatNo : null;
    for (const w of wolves) {
      if (w.isAI && aiTarget !== null) game.night.wolfVotes.set(w.seatNo, aiTarget);
      else if (w.userId) {
        this.privateAction(game, w, 'WOLF_KILL', notice(w.language, 'wolf_pick_prompt'), targets, T.WOLF);
      }
    }
    await this.waitStep(game, T.WOLF, () => this.allWolvesActed(game, wolves));
    game.night.victimSeat = this.tallyWolfVotes(game, targets);
    // 狼爪特效仅狼队可见
    this.emitFx(game, wolves.map((w) => w.userId), 'wolf');
  }

  private async stepSeer(game: Game) {
    const seer = this.alive(game).find((s) => s.role === 'SEER');
    if (!seer) return;
    this.hostAll(game, 'seer_wake');
    const targets = this.alive(game).filter((s) => s.seatNo !== seer.seatNo);
    if (seer.isAI) return; // AI 预言家无需结果回传
    if (!seer.userId) return;
    this.privateAction(game, seer, 'SEER_CHECK', notice(seer.language, 'seer_pick_prompt'), targets, T.SEER);
    await this.waitStep(game, T.SEER, () => game.stepResolve === null && false); // 由 nightAction 提前结束
  }

  private async stepWitch(game: Game) {
    const witch = this.alive(game).find((s) => s.role === 'WITCH');
    if (!witch) return;
    if (witch.antidoteUsed && witch.poisonUsed) return; // 药用完
    this.hostAll(game, 'witch_wake');
    const victim = game.night.victimSeat;
    if (witch.isAI) {
      // AI 女巫：被刀者存活则 50% 用解药；不主动用毒（避免自伤队友）
      if (!witch.antidoteUsed && victim !== null && Math.random() < 0.5) {
        game.night.witchSave = true;
        witch.antidoteUsed = true;
      }
      return;
    }
    if (!witch.userId) return;
    const victimSeat = victim !== null ? game.seats[victim] : null;
    const payload: WolfPrivatePayload = {
      gameId: game.id,
      kind: 'night_action',
      action: 'WITCH',
      text:
        victim !== null
          ? notice(witch.language, 'witch_victim', { seat: victim, name: victimSeat?.displayName ?? '' })
          : notice(witch.language, 'witch_victim_none'),
      canSave: !witch.antidoteUsed && victim !== null,
      canPoison: !witch.poisonUsed,
      victimSeat: victim,
      targets: this.alive(game).filter((s) => s.seatNo !== witch.seatNo).map((s) => ({ seatNo: s.seatNo, displayName: s.displayName })),
      deadlineTs: Date.now() + T.WITCH,
    };
    this.emitter.emitToUser(witch.userId, WEREWOLF_EVENTS.PRIVATE, payload);
    await this.waitStep(game, T.WITCH, () => false);
  }

  private async resolveDawn(game: Game) {
    game.phase = 'dawn';
    const dead: Seat[] = [];
    const victim = game.night.victimSeat;
    if (victim !== null && !game.night.witchSave) {
      const s = game.seats[victim];
      if (s?.alive) dead.push(s);
    }
    if (game.night.witchPoisonSeat !== null) {
      const s = game.seats[game.night.witchPoisonSeat];
      if (s?.alive && !dead.includes(s)) dead.push(s);
    }
    for (const s of dead) s.alive = false;

    this.broadcastState(game);
    this.hostAll(game, 'day_break', { day: game.day });
    if (dead.length === 0) {
      this.hostAll(game, 'no_death');
    } else {
      const names = dead.map((s) => `${s.seatNo}号 ${s.displayName}`).join('、');
      this.hostAll(game, 'deaths', { names });
      for (const s of dead) this.notifyDeath(game, s);
    }

    // 猎人开枪：被毒死不可开枪
    const poisoned = game.night.witchPoisonSeat;
    const hunter = dead.find((s) => s.role === 'HUNTER' && s.seatNo !== poisoned);
    if (hunter) await this.hunterShot(game, hunter);

    await this.sleep(game, T.DAWN_PAUSE);
  }

  // ---------------- 发言（核心翻译阶段）----------------

  private async runSpeak(game: Game) {
    game.phase = 'speak';
    game.speakOrder = this.alive(game).map((s) => s.seatNo);
    game.speakIdx = 0;
    this.hostAll(game, 'speak_start');

    while (game.speakIdx < game.speakOrder.length && !game.aborted) {
      const seatNo = game.speakOrder[game.speakIdx];
      const seat = game.seats[seatNo];
      if (!seat || !seat.alive) {
        game.speakIdx += 1;
        continue;
      }
      game.speakDeadline = Date.now() + T.SPEAK;
      this.broadcastState(game);
      this.hostAll(game, 'speaker_turn', { seat: seatNo, name: seat.displayName });

      if (seat.isAI) {
        await this.sleep(game, T.AI_SPEAK_DELAY);
        await this.aiSpeak(game, seat);
        await this.sleep(game, T.AI_SPEAK_DELAY);
      } else {
        // 真人：等待 pass 或超时自动过麦（其余人静音由前端按 currentSpeakerSeat 控制）
        await this.waitStep(game, T.SPEAK, () => false);
      }
      game.speakIdx += 1;
    }
    game.speakDeadline = null;
  }

  /** 真人发言：把发言者母语一句话，翻成每位听者母语后下发字幕（身份盲）。 */
  async speak(gameId: string, userId: string, text: string): Promise<{ ok: true }> {
    const game = this.must(gameId);
    if (game.phase !== 'speak') throw new BadRequestException({ code: 'NOT_SPEAK_PHASE' });
    const seat = this.seatOf(game, userId);
    if (!seat || !seat.alive) throw new BadRequestException({ code: 'CANNOT_SPEAK' });
    if (game.speakOrder[game.speakIdx] !== seat.seatNo) throw new BadRequestException({ code: 'NOT_YOUR_TURN' });
    await this.fanoutSpeech(game, seat, text);
    return { ok: true };
  }

  /** 主动过麦（结束本人发言）。 */
  pass(gameId: string, userId: string): { ok: true } {
    const game = this.must(gameId);
    if (game.phase !== 'speak') return { ok: true };
    const seat = this.seatOf(game, userId);
    if (seat && game.speakOrder[game.speakIdx] === seat.seatNo) this.finishStep(game);
    return { ok: true };
  }

  private async aiSpeak(game: Game, seat: Seat) {
    const suspect = pick(this.alive(game).filter((s) => s.seatNo !== seat.seatNo));
    const text = aiLine(seat.language, ROLE_CAMP[seat.role], suspect?.seatNo ?? seat.seatNo);
    await this.fanoutSpeech(game, seat, text);
  }

  private async fanoutSpeech(game: Game, from: Seat, text: string) {
    const clipped = text.slice(0, 500);
    const listeners = game.seats.filter((s) => s.userId && s.seatNo !== from.seatNo);
    for (const l of listeners) {
      let translated = clipped;
      if (l.language !== from.language) {
        try {
          translated = await this.engine.translate(clipped, from.language, l.language);
        } catch {
          translated = clipped;
        }
      }
      const payload: WolfSpeechPayload = {
        gameId: game.id,
        fromSeat: from.seatNo,
        fromName: from.displayName,
        originalText: clipped,
        originalLang: from.language,
        translatedText: translated,
        targetLang: l.language,
        ts: Date.now(),
      };
      this.emitter.emitToUser(l.userId!, WEREWOLF_EVENTS.SPEECH, payload);
    }
    // 发言者本人回显原文
    if (from.userId) {
      const payload: WolfSpeechPayload = {
        gameId: game.id,
        fromSeat: from.seatNo,
        fromName: from.displayName,
        originalText: clipped,
        originalLang: from.language,
        translatedText: clipped,
        targetLang: from.language,
        ts: Date.now(),
      };
      this.emitter.emitToUser(from.userId, WEREWOLF_EVENTS.SPEECH, payload);
    }
  }

  // ---------------- 投票 ----------------

  private async runVote(game: Game) {
    game.phase = 'vote';
    game.votes = new Map();
    game.voteDeadline = Date.now() + T.VOTE;
    this.broadcastState(game);
    this.hostAll(game, 'vote_start');

    // AI 立即投票
    for (const s of this.alive(game)) {
      if (s.isAI) game.votes.set(s.seatNo, this.aiVote(game, s));
    }
    await this.waitStep(game, T.VOTE, () => this.allVoted(game));
    game.voteDeadline = null;

    const exiled = this.tallyVotes(game);
    this.broadcastState(game);
    if (exiled === null) {
      this.hostAll(game, 'no_exile');
      return;
    }
    const seat = game.seats[exiled];
    seat.alive = false;
    this.hostAll(game, 'exiled', { seat: exiled, name: seat.displayName });
    this.notifyDeath(game, seat);
    if (seat.role === 'HUNTER') await this.hunterShot(game, seat);
    await this.sleep(game, T.DAWN_PAUSE);
  }

  /** 真人投票。 */
  vote(gameId: string, userId: string, targetSeat: number | null): { ok: true } {
    const game = this.must(gameId);
    if (game.phase !== 'vote') throw new BadRequestException({ code: 'NOT_VOTE_PHASE' });
    const seat = this.seatOf(game, userId);
    if (!seat || !seat.alive) throw new BadRequestException({ code: 'CANNOT_VOTE' });
    if (targetSeat !== null && !game.seats[targetSeat]?.alive) throw new BadRequestException({ code: 'BAD_TARGET' });
    game.votes.set(seat.seatNo, targetSeat);
    this.broadcastState(game);
    if (this.allVoted(game)) this.finishStep(game);
    return { ok: true };
  }

  // ---------------- 夜间行动入口（真人）----------------

  nightAction(
    gameId: string,
    userId: string,
    action: WolfActionType,
    body: { targetSeat?: number; save?: boolean; poisonSeat?: number },
  ): { ok: true } {
    const game = this.must(gameId);
    const seat = this.seatOf(game, userId);
    if (!seat || !seat.alive) throw new BadRequestException({ code: 'CANNOT_ACT' });

    if (action === 'WOLF_KILL') {
      if (seat.role !== 'WOLF') throw new BadRequestException({ code: 'NOT_WOLF' });
      if (body.targetSeat === undefined) throw new BadRequestException({ code: 'NO_TARGET' });
      game.night.wolfVotes.set(seat.seatNo, body.targetSeat);
      const wolves = this.alive(game).filter((s) => s.role === 'WOLF');
      if (this.allWolvesActed(game, wolves)) this.finishStep(game);
    } else if (action === 'SEER_CHECK') {
      if (seat.role !== 'SEER') throw new BadRequestException({ code: 'NOT_SEER' });
      if (body.targetSeat === undefined) throw new BadRequestException({ code: 'NO_TARGET' });
      const target = game.seats[body.targetSeat];
      if (!target) throw new BadRequestException({ code: 'BAD_TARGET' });
      const isWolf = target.role === 'WOLF';
      const text = notice(seat.language, isWolf ? 'seer_is_wolf' : 'seer_is_good', {
        seat: target.seatNo,
        name: target.displayName,
      });
      this.emitter.emitToUser(userId, WEREWOLF_EVENTS.PRIVATE, { gameId, kind: 'seer_result', text } satisfies WolfPrivatePayload);
      this.emitFx(game, [userId], 'seer'); // 预言家眼特效仅本人可见
      this.finishStep(game);
    } else if (action === 'WITCH') {
      if (seat.role !== 'WITCH') throw new BadRequestException({ code: 'NOT_WITCH' });
      if (body.save && !seat.antidoteUsed && game.night.victimSeat !== null) {
        game.night.witchSave = true;
        seat.antidoteUsed = true;
        this.emitFx(game, [userId], 'heal'); // 解药光环仅女巫可见
      }
      if (body.poisonSeat !== undefined && !seat.poisonUsed) {
        game.night.witchPoisonSeat = body.poisonSeat;
        seat.poisonUsed = true;
        this.emitFx(game, [userId], 'poison');
      }
      this.finishStep(game);
    } else if (action === 'HUNTER_SHOT') {
      if (seat.role !== 'HUNTER' || game.pendingHunterSeat !== seat.seatNo) throw new BadRequestException({ code: 'CANNOT_SHOOT' });
      if (body.targetSeat !== undefined) this.applyHunterShot(game, body.targetSeat);
      this.finishStep(game);
    }
    return { ok: true };
  }

  // ---------------- 猎人开枪 ----------------

  private async hunterShot(game: Game, hunter: Seat) {
    const targets = this.alive(game).filter((s) => s.seatNo !== hunter.seatNo);
    if (targets.length === 0) return;
    game.pendingHunterSeat = hunter.seatNo;
    if (hunter.isAI || !hunter.userId) {
      this.applyHunterShot(game, pick(targets).seatNo);
      game.pendingHunterSeat = null;
      return;
    }
    this.emitter.emitToUser(hunter.userId, WEREWOLF_EVENTS.PRIVATE, {
      gameId: game.id,
      kind: 'hunter_shot',
      action: 'HUNTER_SHOT',
      text: notice(hunter.language, 'hunter_prompt'),
      targets: targets.map((s) => ({ seatNo: s.seatNo, displayName: s.displayName })),
      deadlineTs: Date.now() + T.HUNTER,
    } satisfies WolfPrivatePayload);
    await this.waitStep(game, T.HUNTER, () => false);
    game.pendingHunterSeat = null;
  }

  private applyHunterShot(game: Game, targetSeat: number) {
    const t = game.seats[targetSeat];
    if (!t || !t.alive) return;
    t.alive = false;
    this.broadcastState(game);
    this.hostAll(game, 'hunter_fires', { seat: t.seatNo, name: t.displayName });
    this.emitFx(game, game.seats.map((s) => s.userId), 'hunter'); // 猎人开枪是公开的，全场可见
    this.notifyDeath(game, t);
  }

  // ---------------- 胜负 / 结算 ----------------

  private checkWin(game: Game): boolean {
    const alive = this.alive(game);
    const wolves = alive.filter((s) => s.role === 'WOLF').length;
    const goods = alive.length - wolves;
    let winner: WolfCamp | null = null;
    if (wolves === 0) winner = 'GOOD';
    else if (wolves >= goods) winner = 'WOLF';
    if (winner) {
      this.gameOver(game, winner);
      return true;
    }
    return false;
  }

  private gameOver(game: Game, winner: WolfCamp) {
    game.phase = 'over';
    this.broadcastState(game);
    this.hostAll(game, winner === 'WOLF' ? 'wolves_win' : 'good_win');
    const payload: WolfGameOverPayload = {
      gameId: game.id,
      winner,
      reveal: game.seats.map((s) => ({
        seatNo: s.seatNo,
        displayName: s.displayName,
        role: s.role,
        isAI: s.isAI, // 赛后才揭示 AI 身份
        alive: s.alive,
      })),
    };
    this.emitToAll(game, WEREWOLF_EVENTS.GAME_OVER, payload);
    this.destroy(game);
  }

  // ---------------- 公共状态广播 ----------------

  private broadcastState(game: Game) {
    const board = WEREWOLF_BOARDS[game.boardKey];
    const seats: WolfSeatPublic[] = game.seats.map((s) => ({
      seatNo: s.seatNo,
      userId: s.userId,
      displayName: s.displayName,
      alive: s.alive,
      filled: true,
    }));
    const voteTally =
      game.phase === 'vote'
        ? this.aliveSeatNos(game).map((seatNo) => ({
            seatNo,
            votes: [...game.votes.values()].filter((v) => v === seatNo).length,
          }))
        : undefined;
    const payload: WolfStatePayload = {
      gameId: game.id,
      boardKey: game.boardKey,
      boardName: board.name,
      phase: game.phase,
      day: game.day,
      hostUserId: game.hostUserId,
      containsAI: game.containsAI,
      started: game.started,
      seats,
      currentSpeakerSeat: game.phase === 'speak' ? game.speakOrder[game.speakIdx] ?? null : null,
      deadlineTs: game.phase === 'speak' ? game.speakDeadline : game.phase === 'vote' ? game.voteDeadline : null,
      alivePlayers: this.alive(game).length,
      voteTally,
    };
    this.emitToAll(game, WEREWOLF_EVENTS.STATE, payload);
  }

  state(gameId: string): WolfStatePayload {
    const game = this.must(gameId);
    const board = WEREWOLF_BOARDS[game.boardKey];
    return {
      gameId: game.id,
      boardKey: game.boardKey,
      boardName: board.name,
      phase: game.phase,
      day: game.day,
      hostUserId: game.hostUserId,
      containsAI: game.containsAI,
      started: game.started,
      seats: game.seats.map((s) => ({ seatNo: s.seatNo, userId: s.userId, displayName: s.displayName, alive: s.alive, filled: true })),
      currentSpeakerSeat: game.phase === 'speak' ? game.speakOrder[game.speakIdx] ?? null : null,
      deadlineTs: null,
      alivePlayers: this.alive(game).length,
    };
  }

  private hostAll(game: Game, key: HostKey, params: Record<string, string | number> = {}) {
    for (const s of game.seats) {
      if (!s.userId) continue;
      const payload: WolfHostPayload = { gameId: game.id, text: host(s.language, key, params), ts: Date.now() };
      this.emitter.emitToUser(s.userId, WEREWOLF_EVENTS.HOST, payload);
    }
  }

  private privateAction(game: Game, seat: Seat, action: WolfActionType, text: string, targets: Seat[], ms: number) {
    if (!seat.userId) return;
    const payload: WolfPrivatePayload = {
      gameId: game.id,
      kind: 'night_action',
      action,
      text,
      targets: targets.map((s) => ({ seatNo: s.seatNo, displayName: s.displayName })),
      deadlineTs: Date.now() + ms,
    };
    this.emitter.emitToUser(seat.userId, WEREWOLF_EVENTS.PRIVATE, payload);
  }

  private notifyDeath(game: Game, seat: Seat) {
    if (!seat.userId) return;
    this.emitter.emitToUser(seat.userId, WEREWOLF_EVENTS.PRIVATE, {
      gameId: game.id,
      kind: 'notice',
      text: notice(seat.language, 'you_died'),
    } satisfies WolfPrivatePayload);
  }

  /** 夜间特效：仅下发给"有权看到"的玩家（不泄密）。 */
  private emitFx(game: Game, userIds: (string | null)[], type: WolfFxType) {
    const ids = userIds.filter((id): id is string => !!id);
    if (!ids.length) return;
    const payload: WolfFxPayload = { gameId: game.id, type, ts: Date.now() };
    this.emitter.emitToUsers(ids, WEREWOLF_EVENTS.FX, payload);
  }

  private emitToAll(game: Game, event: string, payload: unknown) {
    this.emitter.emitToUsers(
      game.seats.filter((s) => s.userId).map((s) => s.userId!),
      event,
      payload,
    );
  }

  // ---------------- step 等待原语 ----------------

  /** 等待：满足 isDone() 或超时；真人行动后调用 finishStep 提前结束。 */
  private waitStep(game: Game, ms: number, isDone: () => boolean): Promise<void> {
    if (isDone()) return Promise.resolve();
    return new Promise<void>((resolve) => {
      game.stepResolve = resolve;
      game.timer = setTimeout(() => {
        game.stepResolve = null;
        game.timer = null;
        resolve();
      }, ms);
    });
  }

  private finishStep(game: Game) {
    if (game.timer) {
      clearTimeout(game.timer);
      game.timer = null;
    }
    const r = game.stepResolve;
    game.stepResolve = null;
    r?.();
  }

  /** 纯计时停顿（AI 节奏 / 阶段间隔），可被 abort 打断。 */
  private sleep(game: Game, ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      game.stepResolve = resolve;
      game.timer = setTimeout(() => {
        game.stepResolve = null;
        game.timer = null;
        resolve();
      }, ms);
    });
  }

  // ---------------- 工具 ----------------

  private freshNight(): NightState {
    return { wolfVotes: new Map(), victimSeat: null, witchSave: false, witchPoisonSeat: null };
  }
  private alive(game: Game): Seat[] {
    return game.seats.filter((s) => s.alive);
  }
  private aliveSeatNos(game: Game): number[] {
    return this.alive(game).map((s) => s.seatNo);
  }
  private seatOf(game: Game, userId: string): Seat | undefined {
    return game.seats.find((s) => s.userId === userId);
  }
  private allWolvesActed(game: Game, wolves: Seat[]): boolean {
    return wolves.every((w) => game.night.wolfVotes.has(w.seatNo));
  }
  private allVoted(game: Game): boolean {
    return this.alive(game).every((s) => game.votes.has(s.seatNo));
  }
  private tallyWolfVotes(game: Game, targets: Seat[]): number | null {
    const counts = new Map<number, number>();
    for (const t of game.night.wolfVotes.values()) counts.set(t, (counts.get(t) ?? 0) + 1);
    let best: number | null = null;
    let max = 0;
    for (const [seatNo, c] of counts) {
      if (c > max) {
        max = c;
        best = seatNo;
      }
    }
    if (best === null && targets.length) best = pick(targets).seatNo;
    return best;
  }
  private tallyVotes(game: Game): number | null {
    const counts = new Map<number, number>();
    for (const v of game.votes.values()) if (v !== null) counts.set(v, (counts.get(v) ?? 0) + 1);
    let best: number | null = null;
    let max = 0;
    let tie = false;
    for (const [seatNo, c] of counts) {
      if (c > max) {
        max = c;
        best = seatNo;
        tie = false;
      } else if (c === max) {
        tie = true;
      }
    }
    return tie ? null : best; // 平票 → 不放逐（MVP）
  }
  private aiVote(game: Game, voter: Seat): number | null {
    const camp = ROLE_CAMP[voter.role];
    const pool =
      camp === 'WOLF'
        ? this.alive(game).filter((s) => s.role !== 'WOLF')
        : this.alive(game).filter((s) => s.seatNo !== voter.seatNo);
    return pool.length ? pick(pool).seatNo : null;
  }

  private destroy(game: Game) {
    game.aborted = true;
    if (game.timer) {
      clearTimeout(game.timer);
      game.timer = null;
    }
    if (game.stepResolve) {
      const r = game.stepResolve;
      game.stepResolve = null;
      r();
    }
    for (const s of game.seats) if (s.userId) this.userGame.delete(s.userId);
    this.games.delete(game.id);
  }

  private must(gameId: string): Game {
    const game = this.games.get(gameId);
    if (!game) throw new NotFoundException({ code: 'GAME_NOT_FOUND' });
    return game;
  }
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
