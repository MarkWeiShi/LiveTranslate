// 多渠道获客归因 + 漏斗的共享契约（单一数据源：app 解析上报 / backend 记录聚合）。
// Telegram 走 initData（见 telegram.ts，可服务端 HMAC 校验）；
// x / messenger / instagram 等走【UTM 外链】（普通带参链接，无法加密校验，trust=外链）。

export const ATTRIBUTION_CHANNELS = [
  'telegram',
  'x',
  'messenger',
  'instagram',
  'whatsapp',
  'web',
  'direct',
] as const;
export type AttributionChannel = (typeof ATTRIBUTION_CHANNELS)[number];

export const FUNNEL_STAGES = ['land', 'signup', 'activate'] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export interface UtmParams {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  ref?: string; // 邀请码 / referral（裂变归因）
}

/** 把来源原文归一化到渠道枚举（twitter→x, fb→messenger, ig→instagram...）。 */
const CHANNEL_ALIASES: Record<string, AttributionChannel> = {
  telegram: 'telegram', tg: 'telegram',
  x: 'x', twitter: 'x',
  messenger: 'messenger', fb: 'messenger', facebook: 'messenger', 'fb-messenger': 'messenger',
  instagram: 'instagram', ig: 'instagram',
  whatsapp: 'whatsapp', wa: 'whatsapp',
  web: 'web',
};
export function channelFromSource(source?: string | null): AttributionChannel {
  if (!source) return 'direct';
  return CHANNEL_ALIASES[source.trim().toLowerCase()] ?? 'web';
}

/** 解析外链 query（?utm_source=x&utm_campaign=launch&ref=inv42）。纯函数。 */
export function parseUtmParams(search: string): UtmParams {
  const s = search ?? '';
  const q = new URLSearchParams(s.startsWith('?') ? s.slice(1) : s);
  const g = (k: string) => q.get(k) ?? undefined;
  return {
    source: g('utm_source') ?? g('source'),
    medium: g('utm_medium'),
    campaign: g('utm_campaign'),
    content: g('utm_content'),
    term: g('utm_term'),
    ref: g('ref') ?? g('utm_ref'),
  };
}

// ---- 归因端点契约（app POST /attribution → backend）----
export interface AttributionBody {
  tgWebAppData?: string; // Telegram：服务端 HMAC 校验
  source?: string;       // 渠道来源原文（x/twitter/messenger/ig/...）
  utm?: UtmParams;       // 外链 UTM（x/messenger/instagram 等）
}

export interface AttributionDto {
  id: string;
  channel: string;            // 归一化渠道
  source?: string | null;     // 原始来源
  externalId?: string | null; // telegram user id 等
  startParam?: string | null; // telegram start_param（保留兼容）
  ref?: string | null;        // 统一 referral（telegram start_param 或 utm ref）
  campaign?: string | null;
  verified: boolean;          // initData HMAC 是否通过（仅 telegram 真实模式）
  createdAt: string;
}

// ---- 漏斗 ----
export interface FunnelEventBody {
  channel?: string;
  source?: string;
  ref?: string;
  stage: FunnelStage;
  userId?: string;
}
export interface FunnelChannelDto {
  channel: string;
  land: number;
  signup: number;
  activate: number;
  signupRate: number;   // signup/land
  activateRate: number; // activate/signup
}
export interface FunnelDto {
  channels: FunnelChannelDto[];
}
