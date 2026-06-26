// Runtime contracts (zod) for the core WS payloads that cross the mock↔real boundary.
// BuildSpec §5.2. These mirror the compile-time interfaces in events.ts; the test file
// asserts (at compile time) that each zod schema and its TS interface stay structurally equal,
// so mock (backend) and real (Gemini/LiveKit agent) can't drift the wire shape silently.
//
// NOTE: intentionally NOT re-exported from index.ts — keeping zod out of the app/expo bundle.
// Import directly from '@linku/shared/src/contracts' (backend/tests) when runtime validation is needed.
import { z } from 'zod';
import { TRANSLATION_STATES, type TranslationState } from './enums';

const translationStateEnum = z.enum(
  TRANSLATION_STATES as unknown as [TranslationState, ...TranslationState[]],
);

/** call → translation.* lifecycle (BuildSpec §7.2) */
export const TranslationStateSchema = z.object({
  callId: z.string(),
  state: translationStateEnum,
  translatedSecLeft: z.number(),
});

/** paywall fires when the trial is exhausted */
export const TranslationPaywallSchema = z.object({
  callId: z.string(),
  reason: z.literal('trial_exhausted'),
});

/** bilingual caption stream */
export const CaptionSchema = z.object({
  callId: z.string(),
  speakerId: z.string(),
  originalText: z.string(),
  translatedText: z.string(),
  ts: z.number(),
});

/** gift_received */
export const GiftReceivedSchema = z.object({
  callId: z.string(),
  fromId: z.string(),
  giftType: z.string(),
});

/** call_ended — carries billing-relevant durations (backend is the only billing source) */
export const CallEndedSchema = z.object({
  callId: z.string(),
  reason: z.string().optional(),
  durationSec: z.number(),
  translatedSec: z.number(),
});

/** Registry keyed by WS event name → schema, for generic gateway validation. */
export const WS_PAYLOAD_SCHEMAS = {
  'translation.state': TranslationStateSchema,
  'translation.paywall': TranslationPaywallSchema,
  caption: CaptionSchema,
  gift_received: GiftReceivedSchema,
  call_ended: CallEndedSchema,
} as const;
