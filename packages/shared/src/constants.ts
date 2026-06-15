// Shared business constants (BuildSpec §6 risk phrases, §5.6 gifts, §7.3 billing).

/** New-user free translation trial = 7 minutes. */
export const DEFAULT_TRIAL_SECONDS = 420;

/** Cost guardrail: a single call auto-ends after 60 minutes. */
export const CALL_MAX_SECONDS = 60 * 60;

/** Ring timeout before a call is marked MISSED. */
export const RING_TIMEOUT_MS = 30_000;

/** Presence TTL — client heartbeats roughly every 15s. */
export const PRESENCE_TTL_SECONDS = 30;

/** Gift catalog: giftType -> diamond price. */
export const GIFT_CATALOG: Record<string, number> = {
  rose: 1,
  heart: 5,
  star: 10,
  diamond_ring: 50,
};

/** Mock IAP receipts -> grants (used by MockPaymentProvider). */
export interface IapGrant {
  diamonds?: number;
  subscriptionTier?: 'WEEKLY' | 'MONTHLY';
  subscriptionDurationDays?: number;
}
export const MOCK_IAP_RECEIPTS: Record<string, IapGrant> = {
  mock_week: { subscriptionTier: 'WEEKLY', subscriptionDurationDays: 7 },
  mock_month: { subscriptionTier: 'MONTHLY', subscriptionDurationDays: 30 },
  mock_diamonds_100: { diamonds: 100 },
  mock_diamonds_500: { diamonds: 500 },
};

/** Induced-fraud / scam phrase rules, scanned on translated caption text (BuildSpec §6). */
export interface RiskRule {
  type: string;
  score: number;
  pattern: RegExp;
}
export const RISK_RULES: RiskRule[] = [
  {
    type: 'request_external_contact',
    score: 60,
    pattern:
      /\b(whatsapp|telegram|wechat|line\s?id|kakao|signal)\b|微信|加我|加个微信|外部联系方式|私聊我|dame tu (whatsapp|telegram|n[úu]mero)/i,
  },
  {
    type: 'money_transfer',
    score: 80,
    pattern:
      /\b(wire transfer|send money|gift card|western union)\b|汇款|转账|打钱给我|借钱|手续费|押金|transferencia|env[íi]ame dinero|tarjeta de regalo/i,
  },
  {
    type: 'crypto_investment',
    score: 90,
    pattern:
      /\b(crypto|bitcoin|usdt|binance|investment platform|trading signals)\b|稳赚|带你投资|理财项目|虚拟货币|交易所|invertir en cripto|plataforma de inversi[óo]n/i,
  },
];

export const RISK_HIGH_THRESHOLD = 70;
