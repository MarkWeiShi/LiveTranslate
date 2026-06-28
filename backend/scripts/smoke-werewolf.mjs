// 跨语言狼人杀冒烟（mock，运行中的 :3000）。
// 验证：建局(zh) → 私密角色下发 → 开始(空位补 AI) → 收到本地化主持旁白 → 跨语言发言字幕 →
//       AI 自动推进至 GAME_OVER（全角色+AI 揭示）。单真人 + AI 兜底，端到端跑完一局。
import { io } from 'socket.io-client';

const BASE = process.env.BASE ?? 'http://localhost:3000';
let pass = 0, fail = 0;
const ok = (n, c, e = '') => { (c ? pass++ : fail++); console.log(`${c ? '✅' : '❌'} ${n}${e ? '  — ' + e : ''}`); };

async function req(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null; try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, json };
}
const login = (id) => req('POST', '/auth/hellotalk/callback', { body: { mockUserId: id } });
const connect = (token) => io(BASE, { path: '/ws', transports: ['websocket'], auth: { token } });
const onConnect = (s) => new Promise((res, rej) => { s.on('connect', res); s.on('connect_error', rej); });
function waitFor(socket, event, { timeout = 15000, predicate } = {}) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => { socket.off(event, h); rej(new Error('timeout ' + event)); }, timeout);
    function h(p) { if (predicate && !predicate(p)) return; clearTimeout(t); socket.off(event, h); res(p); }
    socket.on(event, h);
  });
}
const safe = (p) => p.then((v) => ({ v })).catch((e) => ({ err: String(e.message ?? e) }));

async function main() {
  console.log(`\n=== Werewolf smoke @ ${BASE} ===\n`);
  const a = await login('seed_male_01'); // 真人，语言 zh
  const aTok = a.json.token;
  const aId = a.json.user.id;

  const sa = connect(aTok);
  await onConnect(sa);
  ok('WS 连接成功', sa.connected);

  // 私密角色应仅发给本人
  const roleP = safe(waitFor(sa, 'wolf.role', {}));
  const hostP = safe(waitFor(sa, 'wolf.host', { predicate: (p) => !!p.text }));
  const overP = safe(waitFor(sa, 'wolf.game_over', { timeout: 90000 }));
  let speechCount = 0; let crossLang = false;
  sa.on('wolf.speech', (p) => { speechCount++; if (p.targetLang === 'zh' && p.originalLang !== 'zh') crossLang = true; });
  const fxTypes = [];
  sa.on('wolf.fx', (p) => { fxTypes.push(p.type); });

  const create = await req('POST', '/werewolf', { token: aTok, body: { boardKey: 'newbie6', language: 'zh' } });
  const gameId = create.json?.gameId;
  ok('建局返回 gameId+token', create.status < 300 && !!gameId && !!create.json?.token, `gameId=${gameId}`);

  // 自动玩家：响应私密夜间行动 + 发言/投票，避免卡在超时上（模拟真人客户端）。
  let mySeat = -1;
  roleP.then((r) => { if (r.v) mySeat = r.v.seatNo; });
  sa.on('wolf.private', async (p) => {
    if (!p.action) return;
    const target = p.targets?.[0]?.seatNo;
    if (p.action === 'WITCH') { await req('POST', `/werewolf/${gameId}/night-action`, { token: aTok, body: { action: 'WITCH' } }); return; }
    if (target !== undefined) await req('POST', `/werewolf/${gameId}/night-action`, { token: aTok, body: { action: p.action, targetSeat: target } });
  });
  let spokeThisTurn = -1;
  sa.on('wolf.state', async (st) => {
    if (st.phase === 'speak' && st.currentSpeakerSeat === mySeat && mySeat >= 0 && spokeThisTurn !== st.day * 100 + mySeat) {
      spokeThisTurn = st.day * 100 + mySeat;
      await req('POST', `/werewolf/${gameId}/speak`, { token: aTok, body: { text: '我是好人，相信我。' } });
      await req('POST', `/werewolf/${gameId}/pass`, { token: aTok });
    } else if (st.phase === 'vote') {
      const t = st.seats.find((x) => x.alive && x.seatNo !== mySeat)?.seatNo ?? null;
      await req('POST', `/werewolf/${gameId}/vote`, { token: aTok, body: { targetSeat: t } });
    }
  });

  const start = await req('POST', `/werewolf/${gameId}/start`, { token: aTok });
  ok('房主开始（空位补 AI）', start.status < 300, JSON.stringify(start.json));

  const role = await roleP;
  ok('收到私密角色（仅本人）', !!role.v?.role && !!role.v?.roleName, role.err ?? `role=${role.v?.role} name=${role.v?.roleName}`);

  const hostLine = await hostP;
  ok('收到本地化主持旁白', !!hostLine.v?.text, hostLine.err ?? `"${hostLine.v?.text}"`);

  // 送礼（复用语聊房礼物经济）：充值后给 1 号麦送 rose，扣费 + 广播
  const beforeBal = (await req('GET', '/wallet', { token: aTok })).json?.diamonds ?? 0;
  await req('POST', '/wallet/recharge/dev', { token: aTok, body: { packId: 'p1' } }); // +50
  const giftP = safe(waitFor(sa, 'wolf.gift', { predicate: (p) => p.fromUserId === aId }));
  const giftRes = await req('POST', `/werewolf/${gameId}/gift`, { token: aTok, body: { giftType: 'rose', toSeat: 1 } });
  const gift = await giftP;
  ok('狼人杀送礼：收到广播（rose=1，受赠1号）', gift.v?.giftType === 'rose' && gift.v?.coins === 1 && gift.v?.toSeat === 1, gift.err ?? `got=${JSON.stringify(gift.v)}`);
  ok('狼人杀送礼：扣费后余额 = 充值后-1', giftRes.json?.balance === beforeBal + 50 - 1, `balance=${giftRes.json?.balance}`);

  // 全程交给 AI 推进，等待结算（AI 步骤瞬时，发言/投票有计时，约数十秒内结束）
  // 投票弃票兜底：防止多次重复投票报错（vote 已记录后再投会被忽略，无妨）
  const over = await overP;
  ok('对局推进至 GAME_OVER', !!over.v?.winner, over.err ?? `winner=${over.v?.winner}`);
  ok('结算揭示全部 6 个座位（含 AI 标记）', over.v?.reveal?.length === 6 && over.v.reveal.some((r) => r.isAI),
    over.err ?? `n=${over.v?.reveal?.length}`);
  ok('对局期间产生跨语言发言字幕（AI 用各自母语→翻成 zh）', speechCount > 0 && crossLang, `speeches=${speechCount} cross=${crossLang}`);

  // 夜间特效按可见性下发：本人若有夜间技能（狼/预言家/女巫）应至少收到一次 wolf.fx
  const myRole = role.v?.role;
  const expectFx = ['WOLF', 'SEER', 'WITCH'].includes(myRole);
  ok('夜间特效按可见性下发（有夜间技能即收到 wolf.fx）', !expectFx || fxTypes.length > 0, `role=${myRole} fx=[${fxTypes.join(',')}]`);

  sa.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exitCode = fail ? 1 : 0;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
