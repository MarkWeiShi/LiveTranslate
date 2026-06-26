// LOOP-L3: Telegram initData 真实校验单测。
// 用一个【假】bot token 自签 initData，离线证明校验逻辑正确——无需真实 Telegram / 真实凭据。
// 运行：node --import tsx --test src/attribution/*.test.ts（已纳入 backend test:unit → gate）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyTelegramInitData } from './telegram-verify';

const BOT = '123456:TEST_FAKE_TOKEN_not_real';

/** 用与生产相同的算法，对给定字段自签出合法 initData（仅测试用）。 */
function sign(fields: Record<string, string>, token = BOT): string {
  const dcs = Object.entries(fields).map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = crypto.createHmac('sha256', secret).update(dcs).digest('hex');
  const p = new URLSearchParams(fields);
  p.set('hash', hash);
  return p.toString();
}

const base = {
  user: JSON.stringify({ id: 777001, username: 'mark' }),
  auth_date: '1719300000',
  start_param: 'ref_x',
  query_id: 'AAA',
};

test('valid signature passes', () => {
  assert.equal(verifyTelegramInitData(sign(base), BOT).ok, true);
});

test('tampered field is rejected', () => {
  const p = new URLSearchParams(sign(base));
  p.set('start_param', 'HACKED'); // hash 未跟着变 → 必须被拒
  assert.equal(verifyTelegramInitData(p.toString(), BOT).ok, false);
});

test('wrong bot token is rejected', () => {
  assert.equal(verifyTelegramInitData(sign(base), '999:OTHER').reason, 'bad_hash');
});

test('missing hash / no token are rejected with reason', () => {
  assert.equal(verifyTelegramInitData('user=x&auth_date=1', BOT).reason, 'no_hash');
  assert.equal(verifyTelegramInitData(sign(base), '').reason, 'no_bot_token');
});

test('expired auth_date is rejected when maxAgeSec set; fresh passes', () => {
  const init = sign(base);
  assert.equal(verifyTelegramInitData(init, BOT, { maxAgeSec: 60, now: 1719300000 + 3600 }).reason, 'expired');
  assert.equal(verifyTelegramInitData(init, BOT, { maxAgeSec: 86400, now: 1719300000 + 10 }).ok, true);
});
