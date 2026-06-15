import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CALL_MAX_SECONDS,
  WS_EVENTS,
  type CaptionPayload,
  type TranslationState,
} from '@linku/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEmitter } from '../realtime/realtime.emitter';
import { KV_STORE, TRANSLATION_ENGINE } from '../config/provider.tokens';
import type { TranslationEngine } from '../adapters/translation/translation-engine.interface';
import type { KvStore } from '../adapters/store/kv-store.interface';
import { CallsService } from '../calls/calls.service';
import { RiskDetectionService } from '../safety/risk-detection.service';

interface Runtime {
  callId: string;
  callerId: string; // billed owner (initiator)
  calleeId: string;
  callerLang: string;
  calleeLang: string;
  state: TranslationState | 'closed';
  ticker: NodeJS.Timeout | null;
  tickIndex: number;
  translatedSec: number;
  trialLeft: number;
  subscribed: boolean;
  startedAt: number;
  external: boolean; // true in gemini mode (agent-driven, no internal ticker)
}

@Injectable()
export class TranslationSessionService {
  private readonly log = new Logger('TranslationSession');
  private sessions = new Map<string, Runtime>();

  constructor(
    private prisma: PrismaService,
    private emitter: RealtimeEmitter,
    private config: ConfigService,
    @Inject(TRANSLATION_ENGINE) private engine: TranslationEngine,
    @Inject(KV_STORE) private kv: KvStore,
    @Inject(forwardRef(() => CallsService)) private calls: CallsService,
    private risk: RiskDetectionService,
  ) {}

  private tickMs(): number {
    const raw = this.config.get<string>('TICK_INTERVAL_MS');
    const v = raw ? Number(raw) : NaN;
    return Number.isFinite(v) && v > 0 ? v : 1000;
  }

  /** Test-only trial override; empty/unset env must be ignored (Number('') === 0!). */
  private trialOverride(): number | null {
    const raw = this.config.get<string>('TRIAL_SECONDS_OVERRIDE');
    if (raw === undefined || raw === null || raw === '') return null;
    const v = Number(raw);
    return Number.isFinite(v) && v >= 0 ? v : null;
  }

  private isSubscribed(w: { subscriptionTier: string; subscriptionExpiry: Date | null }): boolean {
    return (
      w.subscriptionTier !== 'NONE' &&
      !!w.subscriptionExpiry &&
      w.subscriptionExpiry.getTime() > Date.now()
    );
  }

  /** Called from CallsService.accept when translationOn. Server is the sole accountant. */
  async start(callId: string): Promise<void> {
    if (this.sessions.has(callId)) return;
    const call = await this.prisma.callSession.findUnique({ where: { id: callId } });
    if (!call || call.status !== 'ACTIVE') return;

    const [caller, callee] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: call.callerId } }),
      this.prisma.user.findUnique({ where: { id: call.calleeId } }),
    ]);
    if (!caller || !callee) return;

    // defensive concurrency guard (create() already enforces 1 call/user) — AC-PAY-3
    await this.kv.acquireLock(`xlate_lock:${call.callerId}`, CALL_MAX_SECONDS);

    // test fast-path: shrink trial so paywall fires quickly
    const override = this.trialOverride();
    let wallet = await this.prisma.wallet.findUnique({ where: { userId: call.callerId } });
    if (!wallet) {
      wallet = await this.prisma.wallet.create({ data: { userId: call.callerId } });
    }
    if (override !== null && wallet.trialSecondsLeft > override) {
      wallet = await this.prisma.wallet.update({
        where: { userId: call.callerId },
        data: { trialSecondsLeft: override },
      });
    }

    const subscribed = this.isSubscribed(wallet);
    const external = this.config.get('TRANSLATION_PROVIDER') === 'gemini';
    const rt: Runtime = {
      callId,
      callerId: call.callerId,
      calleeId: call.calleeId,
      callerLang: caller.nativeLanguage,
      calleeLang: callee.nativeLanguage,
      state: 'active',
      ticker: null,
      tickIndex: 0,
      translatedSec: 0,
      trialLeft: wallet.trialSecondsLeft,
      subscribed,
      startedAt: Date.now(),
      external,
    };

    // preflight paywall: no trial + not subscribed -> call proceeds without translation
    if (!subscribed && rt.trialLeft <= 0) {
      rt.state = 'paywall';
      this.sessions.set(callId, rt);
      this.emitPaywall(rt);
      return;
    }

    this.sessions.set(callId, rt);
    this.emitState(rt);

    // In gemini mode the external agent drives billing via reportFromAgent(); no internal ticker.
    if (!external) {
      rt.ticker = setInterval(() => void this.tick(callId), this.tickMs());
      if (typeof rt.ticker.unref === 'function') rt.ticker.unref();
    }
  }

  private async tick(callId: string) {
    const rt = this.sessions.get(callId);
    if (!rt || rt.state === 'closed') return;
    rt.tickIndex++;

    // 60-minute cost-guardrail cap
    if (Date.now() - rt.startedAt >= CALL_MAX_SECONDS * 1000) {
      await this.calls.end(callId, rt.callerId, 'duration_cap').catch(() => undefined);
      return;
    }
    if (rt.state === 'paused' || rt.state === 'paywall') return;

    const speakerIsCaller = Math.floor(rt.tickIndex / 3) % 2 === 0;
    const speakerId = speakerIsCaller ? rt.callerId : rt.calleeId;
    const sourceLang = speakerIsCaller ? rt.callerLang : rt.calleeLang;
    const targetLang = speakerIsCaller ? rt.calleeLang : rt.callerLang;

    const result = await this.engine.produceTick({
      callId,
      speakerId,
      sourceLang,
      targetLang,
      tickIndex: rt.tickIndex,
    });

    if (result.state === 'degraded' || result.error) {
      if (rt.state !== 'degraded') {
        rt.state = 'degraded';
        this.emitState(rt);
      }
      return; // captions-only / no audio billing
    }
    if (rt.state === 'degraded') {
      rt.state = 'active';
      this.emitState(rt);
    }

    await this.bill(rt, result.seconds, result.originalText, result.translatedText, speakerId);
  }

  /** Shared billing + caption + risk + paywall path for BOTH mock ticker and real agent ingress. */
  private async bill(
    rt: Runtime,
    seconds: number,
    originalText: string | undefined,
    translatedText: string | undefined,
    speakerId: string,
  ) {
    if (seconds > 0) {
      rt.translatedSec += seconds;
      await this.prisma.callSession.update({
        where: { id: rt.callId },
        data: { translatedSec: { increment: seconds } },
      });
      if (!rt.subscribed) {
        rt.trialLeft = Math.max(0, rt.trialLeft - seconds);
        await this.prisma.wallet.update({
          where: { userId: rt.callerId },
          data: { trialSecondsLeft: rt.trialLeft },
        });
      }
    }

    if (originalText || translatedText) {
      const caption: CaptionPayload = {
        callId: rt.callId,
        speakerId,
        originalText: originalText ?? '',
        translatedText: translatedText ?? '',
        ts: Date.now(),
      };
      this.emitter.emitToUsers([rt.callerId, rt.calleeId], WS_EVENTS.CAPTION, caption);
      await this.risk.scanCaption(rt.callId, [rt.callerId, rt.calleeId], caption);
    }

    this.emitState(rt);

    if (!rt.subscribed && rt.trialLeft <= 0 && rt.state === 'active') {
      rt.state = 'paywall';
      this.emitPaywall(rt);
    }
  }

  /** Real-mode ingress: Python agent reports translated seconds + captions (same accounting path). */
  async reportFromAgent(input: {
    callId: string;
    speakerId: string;
    seconds: number;
    originalText?: string;
    translatedText?: string;
    state?: 'active' | 'degraded';
  }): Promise<void> {
    const rt = this.sessions.get(input.callId);
    if (!rt || rt.state === 'closed') return;
    if (input.state === 'degraded') {
      if (rt.state !== 'degraded') {
        rt.state = 'degraded';
        this.emitState(rt);
      }
      return;
    }
    if (rt.state === 'paused' || rt.state === 'paywall') return;
    await this.bill(rt, input.seconds, input.originalText, input.translatedText, input.speakerId);
  }

  async toggle(callId: string, on: boolean): Promise<{ paywall: boolean }> {
    const rt = this.sessions.get(callId);
    if (!rt) return { paywall: false };
    if (!on) {
      rt.state = 'paused';
      this.emitState(rt);
      return { paywall: false };
    }
    if (rt.subscribed || rt.trialLeft > 0) {
      rt.state = 'active';
      this.emitState(rt);
      return { paywall: false };
    }
    rt.state = 'paywall';
    this.emitPaywall(rt);
    return { paywall: true };
  }

  /** Called by WalletController after a successful purchase to resume a paywalled call. */
  async resumeAfterPurchase(userId: string): Promise<void> {
    for (const rt of this.sessions.values()) {
      if (rt.callerId !== userId) continue;
      const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
      if (!wallet) continue;
      rt.subscribed = this.isSubscribed(wallet);
      rt.trialLeft = wallet.trialSecondsLeft;
      if (rt.state === 'paywall' && (rt.subscribed || rt.trialLeft > 0)) {
        rt.state = 'active';
        this.emitState(rt);
        if (!rt.ticker && !rt.external) {
          rt.ticker = setInterval(() => void this.tick(rt.callId), this.tickMs());
          if (typeof rt.ticker.unref === 'function') rt.ticker.unref();
        }
      }
    }
  }

  async stop(callId: string): Promise<number> {
    const rt = this.sessions.get(callId);
    if (!rt) {
      const call = await this.prisma.callSession.findUnique({ where: { id: callId } });
      return call?.translatedSec ?? 0;
    }
    if (rt.ticker) clearInterval(rt.ticker);
    rt.state = 'closed';
    this.sessions.delete(callId);
    await this.kv.releaseLock(`xlate_lock:${rt.callerId}`);
    return rt.translatedSec;
  }

  /** test/dev hook to force degrade/failure (AC-XLATE-2). */
  injectFault(callId: string, fault: 'latency' | 'fail' | 'none') {
    this.engine.injectFault(callId, fault);
  }

  // ---- emit helpers ----
  private emitState(rt: Runtime) {
    this.emitter.emitToUsers([rt.callerId, rt.calleeId], WS_EVENTS.TRANSLATION_STATE, {
      callId: rt.callId,
      state: rt.state === 'closed' ? 'paused' : rt.state,
      translatedSecLeft: rt.subscribed ? -1 : rt.trialLeft,
    });
  }
  private emitPaywall(rt: Runtime) {
    this.emitter.emitToUsers([rt.callerId, rt.calleeId], WS_EVENTS.TRANSLATION_PAYWALL, {
      callId: rt.callId,
      reason: 'trial_exhausted',
    });
    this.emitState(rt);
  }
}
