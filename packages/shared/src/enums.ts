// Enum semantics shared by backend (validation) and app (typing).
// SQLite has no native enums, so these are TS string-literal unions persisted as String columns.

export const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;
export type Gender = (typeof GENDERS)[number];

export const INTENTS = ['SOCIAL', 'DEEP', 'LANG_SOCIAL'] as const;
export type Intent = (typeof INTENTS)[number];

export const SUB_TIERS = ['NONE', 'WEEKLY', 'MONTHLY'] as const;
export type SubTier = (typeof SUB_TIERS)[number];

export const CALL_MODES = ['VIDEO', 'VOICE'] as const;
export type CallMode = (typeof CALL_MODES)[number];

export const CALL_STATUSES = ['RINGING', 'ACTIVE', 'ENDED', 'DECLINED', 'MISSED'] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

export const FRIEND_STATUSES = ['PENDING', 'ACCEPTED'] as const;
export type FriendStatus = (typeof FRIEND_STATUSES)[number];

// Translation session lifecycle (BuildSpec §7.2)
export const TRANSLATION_STATES = ['active', 'paused', 'degraded', 'paywall'] as const;
export type TranslationState = (typeof TRANSLATION_STATES)[number];

export const REPORT_REASONS = [
  'HARASSMENT',
  'SCAM_FRAUD',
  'INAPPROPRIATE',
  'FAKE_PROFILE',
  'OTHER',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
