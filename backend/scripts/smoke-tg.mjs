// LOOP-L3 real-mode smoke：证明 ATTRIBUTION_VERIFY=telegram 的 HTTP 链路端到端可用。
// 不需要真实 Telegram bot —— 用与后端相同的【测试 token】自签 initData，验证：
//   合法 initData → 201 + verified=true；篡改 → 400 BAD_TELEGRAM_INITDATA。
// 前置：后端以 ATTRIBUTION_VERIFY=telegram + TELEGRAM_BOT_TOKEN=<同一测试token> 运行。
import crypto from 'node:crypto';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✅' : '❌'} ${name}${extra ? '  — ' + extra : ''}`); };

if (!TOKEN) { console.error('TELEGRAM_BOT_TOKEN 未设置（gate 真实模式子运行应注入测试 token）'); process.exitCode = 1; }

function sign(fields, token = TOKEN) {
  const dcs = Object.entries(fields).map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = crypto.createHmac('sha256', secret).update(dcs).digest('hex');
  const p = new URLSearchParams(fields); p.set('hash', hash);
  return p.toString();
}
const post = (body) => fetch(BASE + '/attribution', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));

async function main() {
  console.log(`\n=== LinkU real-mode (telegram) smoke @ ${BASE} ===\n`);
  const authDate = String(Math.floor(Date.now() / 1000)); // 新鲜，避免 maxAge 过期
  const fields = { user: JSON.stringify({ id: 888002, username: 'real_tg' }), auth_date: authDate, start_param: 'ref_real' };

  const good = await post({ tgWebAppData: sign(fields) });
  ok('real-mode valid initData → 201 + verified=true', good.status === 201 && good.json?.verified === true && good.json?.source === 'telegram', `status=${good.status} verified=${good.json?.verified}`);

  const tampered = new URLSearchParams(sign(fields)); tampered.set('start_param', 'HACKED');
  const bad = await post({ tgWebAppData: tampered.toString() });
  ok('real-mode tampered initData → 400 rejected', bad.status === 400 && bad.json?.code === 'BAD_TELEGRAM_INITDATA', `status=${bad.status} code=${bad.json?.code}`);

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exitCode = fail ? 1 : 0;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
