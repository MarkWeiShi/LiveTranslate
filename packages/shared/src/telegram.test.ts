// LOOP-L2: Telegram 启动上下文解析单测（获客归因的单一数据源保障）。
// 运行：node --import tsx --test src/telegram.test.ts（已纳入 shared 的 npm test → gate）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTelegramInitData } from './telegram';

// 一个典型的 Telegram WebApp initData（URL 编码），含 user(JSON) + start_param(邀请码) + auth_date。
const sampleUser = encodeURIComponent(
  JSON.stringify({ id: 555123, username: 'mark', first_name: 'Mark', language_code: 'zh' }),
);
const SAMPLE = `query_id=AAABBB&user=${sampleUser}&auth_date=1719300000&start_param=ref_inviter42&hash=deadbeef`;

test('parses user / startParam / authDate from initData', () => {
  const ctx = parseTelegramInitData(SAMPLE);
  assert.equal(ctx.source, 'telegram');
  assert.equal(ctx.user?.id, 555123);
  assert.equal(ctx.user?.username, 'mark');
  assert.equal(ctx.user?.languageCode, 'zh');
  assert.equal(ctx.startParam, 'ref_inviter42'); // 回流归因关键字段
  assert.equal(ctx.authDate, 1719300000);
  assert.equal(ctx.raw, SAMPLE);
});

test('tolerates empty / malformed input without throwing', () => {
  const empty = parseTelegramInitData('');
  assert.equal(empty.source, 'telegram');
  assert.equal(empty.user, undefined);
  assert.equal(empty.startParam, undefined);

  const bad = parseTelegramInitData('user=%7Bnot-json%7D&start_param=x');
  assert.equal(bad.user, undefined);     // 坏 JSON 被吞，不崩
  assert.equal(bad.startParam, 'x');     // 其余字段仍解析
});

test('ignores non-numeric auth_date', () => {
  const ctx = parseTelegramInitData('auth_date=notanumber');
  assert.equal(ctx.authDate, undefined);
});
