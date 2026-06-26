export interface TickContext {
  callId: string;
  speakerId: string;
  sourceLang: string; // speaker native language
  targetLang: string; // listener native language
  tickIndex: number;
}

export interface TickResult {
  seconds: number; // translated seconds produced this tick (server bills this)
  originalText?: string;
  translatedText?: string;
  state: 'active' | 'degraded';
  error?: boolean;
}

export type InjectedFault = 'latency' | 'fail' | 'none';

export interface TranslationEngine {
  produceTick(ctx: TickContext): Promise<TickResult>;
  /** test/dev hook to force degrade/failure for AC-XLATE-2. */
  injectFault(callId: string, fault: InjectedFault): void;
  /** MT 段：把一句话从 sourceLang 翻到 targetLang（语聊房字幕用；1v1 调用路径仍走 produceTick）。 */
  translate(text: string, sourceLang: string, targetLang: string): Promise<string>;
}
