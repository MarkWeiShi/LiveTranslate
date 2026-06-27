import { useEffect, useRef, useState } from 'react';

// 浏览器原生语音识别（Web Speech API）STT —— 免服务端、免密钥、多语言，适合 H5/Telegram Mini App。
// 说话 → 识别成发言者母语文本 → 交给 wolfSpeak，后端再翻成各听者母语（复用现有翻译扇出）。
// 支持：Chrome/Edge/Android WebView 良好；iOS Safari/部分 WKWebView 不支持 → supported=false，降级打字。

// 我们的语言码 → BCP-47
const BCP47: Record<string, string> = { zh: 'zh-CN', en: 'en-US', es: 'es-ES', ar: 'ar-SA' };

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
}

function getCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechSupported(): boolean {
  return getCtor() !== null;
}

export function useSpeechRecognition(opts: {
  lang: string;
  active: boolean;
  onFinal: (text: string) => void;
  onInterim?: (text: string) => void;
}): { supported: boolean } {
  const { lang, active, onFinal, onInterim } = opts;
  const [supported] = useState<boolean>(() => speechSupported());
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const activeRef = useRef(active);
  const cbRef = useRef({ onFinal, onInterim });
  cbRef.current = { onFinal, onInterim };
  activeRef.current = active;

  useEffect(() => {
    const Ctor = getCtor();
    if (!Ctor) return;

    if (!active) {
      recRef.current?.stop();
      recRef.current = null;
      return;
    }

    const rec = new Ctor();
    rec.lang = BCP47[lang] ?? 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0]?.transcript ?? '';
        if (r.isFinal) {
          const t = text.trim();
          if (t) cbRef.current.onFinal(t);
        } else {
          interim += text;
        }
      }
      cbRef.current.onInterim?.(interim);
    };
    // 识别会在静默后自动结束；若仍处于发言轮则自动重启，保持连续听写。
    rec.onend = () => { if (activeRef.current && recRef.current === rec) { try { rec.start(); } catch { /* already started */ } } };
    rec.onerror = () => { /* 忽略单次错误，onend 会尝试重启 */ };
    recRef.current = rec;
    try { rec.start(); } catch { /* ignore */ }

    return () => {
      rec.onend = null;
      rec.onresult = null;
      try { rec.abort(); } catch { /* ignore */ }
      if (recRef.current === rec) recRef.current = null;
    };
  }, [active, lang]);

  return { supported };
}
