import type {
  InjectedFault,
  TickContext,
  TickResult,
  TranslationEngine,
} from './translation-engine.interface';

/**
 * Real Gemini mode: the backend does NOT drive ticks here — the external Python LiveKit agent
 * bridges Gemini Live Translate and reports translated seconds + captions to the backend's
 * single accounting ingress (POST /internal/agent/report). This stub exists only so the engine
 * token resolves; TranslationSession switches to "external/agent-driven" mode when
 * TRANSLATION_PROVIDER=gemini (no internal ticker). See agent/README.md.
 */
export class GeminiTranslationEngine implements TranslationEngine {
  readonly external = true;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async produceTick(_ctx: TickContext): Promise<TickResult> {
    // Never called in gemini mode (session is agent-driven). Return inert.
    return { seconds: 0, state: 'active' };
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  injectFault(_callId: string, _fault: InjectedFault): void {
    /* no-op in real mode */
  }

  // MVP passthrough：真实模式语聊房字幕将由外部 Gemini agent 产出（见 agent/README.md）。
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async translate(text: string, _sourceLang: string, _targetLang: string): Promise<string> {
    return text;
  }
}
