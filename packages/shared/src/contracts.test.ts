// LOOP-L1: shared 契约测试（防 mock↔real 漂移）。
// 两层保障：
//   (A) 编译期：zod schema 的推断类型 与 events.ts 的 TS 接口 双向可赋值（结构相等）→ gate 的 typecheck 强制；
//   (B) 运行期：每个核心载荷做 schema round-trip（合法样本 parse→序列化→再 parse 相等；非法样本被拒）。
// 运行：node --import tsx --test src/contracts.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

import {
  CaptionSchema,
  TranslationStateSchema,
  TranslationPaywallSchema,
  GiftReceivedSchema,
  CallEndedSchema,
} from './contracts';
import type {
  CaptionPayload,
  TranslationStatePayload,
  TranslationPaywallPayload,
  GiftReceivedPayload,
  CallEndedPayload,
} from './events';

// ---------- (A) 编译期防漂移：zod ⇔ TS 接口 双向赋值 ----------
// 若任一字段在 events.ts 或 contracts.ts 漂移，下面任一行都会编译失败 → gate typecheck 红。
const _caption_zod_to_ts: CaptionPayload = null as unknown as z.infer<typeof CaptionSchema>;
const _caption_ts_to_zod: z.infer<typeof CaptionSchema> = null as unknown as CaptionPayload;
const _xstate_zod_to_ts: TranslationStatePayload = null as unknown as z.infer<typeof TranslationStateSchema>;
const _xstate_ts_to_zod: z.infer<typeof TranslationStateSchema> = null as unknown as TranslationStatePayload;
const _paywall_zod_to_ts: TranslationPaywallPayload = null as unknown as z.infer<typeof TranslationPaywallSchema>;
const _paywall_ts_to_zod: z.infer<typeof TranslationPaywallSchema> = null as unknown as TranslationPaywallPayload;
const _gift_zod_to_ts: GiftReceivedPayload = null as unknown as z.infer<typeof GiftReceivedSchema>;
const _gift_ts_to_zod: z.infer<typeof GiftReceivedSchema> = null as unknown as GiftReceivedPayload;
const _ended_zod_to_ts: CallEndedPayload = null as unknown as z.infer<typeof CallEndedSchema>;
const _ended_ts_to_zod: z.infer<typeof CallEndedSchema> = null as unknown as CallEndedPayload;
void [
  _caption_zod_to_ts, _caption_ts_to_zod, _xstate_zod_to_ts, _xstate_ts_to_zod,
  _paywall_zod_to_ts, _paywall_ts_to_zod, _gift_zod_to_ts, _gift_ts_to_zod,
  _ended_zod_to_ts, _ended_ts_to_zod,
];

// ---------- (B) 运行期 round-trip ----------
function roundTrip<T>(schema: z.ZodType<T>, sample: T) {
  const parsed = schema.parse(sample);
  const reparsed = schema.parse(JSON.parse(JSON.stringify(parsed)));
  assert.deepEqual(reparsed, sample);
}

test('call_ended round-trips + rejects missing durationSec', () => {
  roundTrip(CallEndedSchema, { callId: 'c1', durationSec: 5, translatedSec: 1004 });
  roundTrip(CallEndedSchema, { callId: 'c1', reason: 'hangup', durationSec: 5, translatedSec: 0 });
  assert.throws(() => CallEndedSchema.parse({ callId: 'c1', translatedSec: 0 }));
});

test('translation.state round-trips + rejects bad state', () => {
  roundTrip(TranslationStateSchema, { callId: 'c1', state: 'active', translatedSecLeft: 420 });
  roundTrip(TranslationStateSchema, { callId: 'c1', state: 'paywall', translatedSecLeft: 0 });
  assert.throws(() => TranslationStateSchema.parse({ callId: 'c1', state: 'nope', translatedSecLeft: 1 }));
});

test('translation.paywall round-trips + pins reason literal', () => {
  roundTrip(TranslationPaywallSchema, { callId: 'c1', reason: 'trial_exhausted' });
  assert.throws(() => TranslationPaywallSchema.parse({ callId: 'c1', reason: 'other' }));
});

test('gift_received round-trips + rejects missing giftType', () => {
  roundTrip(GiftReceivedSchema, { callId: 'c1', fromId: 'u1', giftType: 'rose' });
  assert.throws(() => GiftReceivedSchema.parse({ callId: 'c1', fromId: 'u1' }));
});

test('caption round-trips + rejects non-number ts', () => {
  roundTrip(CaptionSchema, {
    callId: 'c1', speakerId: 'u1',
    originalText: '¿Qué tal tu día?', translatedText: '你今天过得怎么样？', ts: 1719300000000,
  });
  assert.throws(() => CaptionSchema.parse({
    callId: 'c1', speakerId: 'u1', originalText: 'a', translatedText: 'b', ts: 'now',
  }));
});
