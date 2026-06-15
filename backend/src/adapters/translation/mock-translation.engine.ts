import type {
  InjectedFault,
  TickContext,
  TickResult,
  TranslationEngine,
} from './translation-engine.interface';

// Parallel phrase bank — believable bilingual captions without a real model.
// originalText = phrase in speaker's source lang; translatedText = same phrase in listener's lang.
type Lang = 'zh' | 'en' | 'es' | 'ar';
const PHRASE_BANK: Record<Lang, string[]> = {
  zh: ['你好，很高兴认识你！', '你今天过得怎么样？', '我喜欢旅行和摄影。', '你最喜欢哪种音乐？', '希望以后能去你的城市看看。'],
  en: ['Hi, nice to meet you!', 'How was your day?', 'I love traveling and photography.', 'What kind of music do you like?', 'I hope to visit your city someday.'],
  es: ['¡Hola, mucho gusto!', '¿Qué tal tu día?', 'Me encanta viajar y la fotografía.', '¿Qué tipo de música te gusta?', 'Espero poder visitar tu ciudad algún día.'],
  ar: ['مرحبا، سعيد بلقائك!', 'كيف كان يومك؟', 'أحب السفر والتصوير.', 'ما نوع الموسيقى التي تحبها؟', 'آمل أن أزور مدينتك يوما ما.'],
};

function phrase(lang: string, idx: number): string {
  const bank = PHRASE_BANK[(lang as Lang)] ?? PHRASE_BANK.en;
  const text = bank[idx % bank.length];
  return PHRASE_BANK[(lang as Lang)] ? text : `[${lang}] ${text}`;
}

export class MockTranslationEngine implements TranslationEngine {
  private faults = new Map<string, InjectedFault>();

  injectFault(callId: string, fault: InjectedFault): void {
    if (fault === 'none') this.faults.delete(callId);
    else this.faults.set(callId, fault);
  }

  async produceTick(ctx: TickContext): Promise<TickResult> {
    const fault = this.faults.get(ctx.callId) ?? 'none';
    if (fault === 'fail') {
      return { seconds: 0, state: 'degraded', error: true };
    }
    if (fault === 'latency') {
      // simulate over-threshold latency -> degrade to subtitle-only (no audio billing)
      return { seconds: 0, state: 'degraded' };
    }
    // Emit a caption roughly every 3 ticks to feel like natural speech turns.
    const speak = ctx.tickIndex % 3 === 0;
    const i = Math.floor(ctx.tickIndex / 3);
    return {
      seconds: 1,
      state: 'active',
      originalText: speak ? phrase(ctx.sourceLang, i) : undefined,
      translatedText: speak ? phrase(ctx.targetLang, i) : undefined,
    };
  }
}
