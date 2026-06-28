// LOOP-R0 巴别塔语聊房冒烟：2 人跨语言房 + 字幕扇出（mock，运行中的 :3000）。
// 验证：建房→双人加入(zh/es)→成员加入事件→A 说中文 B 收到西语字幕(命中平行库)→B 说西语 A 收到中文字幕→发言者不收自己字幕。
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
function waitFor(socket, event, { timeout = 6000, predicate } = {}) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => { socket.off(event, h); rej(new Error('timeout ' + event)); }, timeout);
    function h(p) { if (predicate && !predicate(p)) return; clearTimeout(t); socket.off(event, h); res(p); }
    socket.on(event, h);
  });
}
const safe = (p) => p.then((v) => ({ v })).catch((e) => ({ err: String(e.message ?? e) }));

async function main() {
  console.log(`\n=== Babel Room smoke @ ${BASE} ===\n`);
  const a = await login('seed_male_01');   // zh
  const b = await login('seed_female_01');  // es
  const aTok = a.json.token, bTok = b.json.token;
  const aId = a.json.user.id, bId = b.json.user.id;

  const sa = connect(aTok), sb = connect(bTok);
  await Promise.all([onConnect(sa), onConnect(sb)]);
  ok('两个 WS 客户端连接成功', sa.connected && sb.connected);

  // A 不应收到自己发言的字幕：记录是否收到 fromUserId===aId 的字幕
  let aGotOwn = false;
  sa.on('room.caption', (p) => { if (p.fromUserId === aId) aGotOwn = true; });

  const room = await req('POST', '/rooms', { token: aTok });
  const roomId = room.json?.roomId;
  ok('建房返回 roomId+token', room.status < 300 && !!roomId && !!room.json?.token, `roomId=${roomId}`);

  await req('POST', `/rooms/${roomId}/join`, { token: aTok, body: { language: 'zh' } });
  const joinedP = safe(waitFor(sa, 'room.member_joined', { predicate: (p) => p.member?.userId === bId }));
  await req('POST', `/rooms/${roomId}/join`, { token: bTok, body: { language: 'es' } });
  const joined = await joinedP;
  ok('A 收到 B 加入事件（lang=es）', joined.v?.member?.language === 'es', joined.err ?? `lang=${joined.v?.member?.language}`);

  // A 说中文 → B 收到西语字幕（命中平行短语库）
  const capBP = safe(waitFor(sb, 'room.caption', { predicate: (p) => p.fromUserId === aId }));
  await req('POST', `/rooms/${roomId}/utterance`, { token: aTok, body: { text: '你好，很高兴认识你！' } });
  const capB = await capBP;
  ok('B 收到 中→西 字幕', capB.v?.targetLang === 'es' && capB.v?.originalLang === 'zh' && !!capB.v?.translatedText,
    capB.err ?? `"${capB.v?.originalText}" → "${capB.v?.translatedText}"`);
  ok('翻译命中平行库（非回退占位）', capB.v?.translatedText === '¡Hola, mucho gusto!', `got="${capB.v?.translatedText}"`);

  // B 说西语 → A 收到中文字幕
  const capAP = safe(waitFor(sa, 'room.caption', { predicate: (p) => p.fromUserId === bId }));
  await req('POST', `/rooms/${roomId}/utterance`, { token: bTok, body: { text: '¿Qué tal tu día?' } });
  const capA = await capAP;
  ok('A 收到 西→中 字幕', capA.v?.targetLang === 'zh' && capA.v?.translatedText === '你今天过得怎么样？', capA.err ?? `got="${capA.v?.translatedText}"`);

  ok('发言者不收到自己的字幕（仅扇给他人）', aGotOwn === false);

  // ---- 玩法：双语弹幕（扇给所有人，含发送者）----
  const barrageBP = safe(waitFor(sb, 'room.barrage', { predicate: (p) => p.fromUserId === aId }));
  const barrageAP = safe(waitFor(sa, 'room.barrage', { predicate: (p) => p.fromUserId === aId }));
  await req('POST', `/rooms/${roomId}/barrage`, { token: aTok, body: { text: '你今天过得怎么样？' } });
  const [bB, bA] = await Promise.all([barrageBP, barrageAP]);
  ok('弹幕：B 收到西语译文', bB.v?.targetLang === 'es' && bB.v?.translatedText === '¿Qué tal tu día?', bB.err ?? `got=${bB.v?.translatedText}`);
  ok('弹幕：发送者本人也收到（含自己）', bA.v?.fromUserId === aId && bA.v?.targetLang === 'zh', bA.err ?? '');

  // ---- 玩法：上麦排队 ----
  const q1P = safe(waitFor(sb, 'room.queue_updated', { predicate: (p) => p.queue.some((q) => q.userId === aId) }));
  await req('POST', `/rooms/${roomId}/raise-hand`, { token: aTok });
  const q1 = await q1P;
  ok('排队：A 举手 → 广播含 A', q1.v?.queue?.[0]?.userId === aId, q1.err ?? `q=${JSON.stringify(q1.v?.queue)}`);
  const q2P = safe(waitFor(sa, 'room.queue_updated', { predicate: (p) => p.queue.length === 2 }));
  await req('POST', `/rooms/${roomId}/raise-hand`, { token: bTok });
  const q2 = await q2P;
  ok('排队：B 举手 → [A,B] FIFO', q2.v?.queue?.[1]?.userId === bId, q2.err ?? '');
  const q3P = safe(waitFor(sa, 'room.queue_updated', { predicate: (p) => p.queue.length === 1 }));
  await req('POST', `/rooms/${roomId}/lower-hand`, { token: aTok });
  const q3 = await q3P;
  ok('排队：A 放下 → 只剩 B', q3.v?.queue?.[0]?.userId === bId, q3.err ?? '');

  // ---- 玩法：跨语言传话小游戏 ----
  const turnP = safe(waitFor(sb, 'room.telephone_turn', { predicate: (p) => p.toUserId === bId }));
  const start = await req('POST', `/rooms/${roomId}/telephone/start`, { token: aTok, body: { text: '你好，很高兴认识你！' } });
  const gameId = start.json?.gameId;
  const turn = await turnP;
  ok('传话：B 收到轮次（听到西语）', turn.v?.heardLang === 'es' && turn.v?.heardText === '¡Hola, mucho gusto!', turn.err ?? `heard=${turn.v?.heardText}`);
  const resAP = safe(waitFor(sa, 'room.telephone_result', {}));
  const resBP = safe(waitFor(sb, 'room.telephone_result', {}));
  await req('POST', `/rooms/${roomId}/telephone/pass`, { token: bTok, body: { gameId, text: '¿Qué tal tu día?' } });
  const [rA] = await Promise.all([resAP, resBP]);
  ok('传话：结果链 2 跳 + 起止文本', rA.v?.chain?.length === 2 && rA.v?.startText === '你好，很高兴认识你！' && rA.v?.endText === '¿Qué tal tu día?', rA.err ?? `chain=${rA.v?.chain?.length}`);

  // ---- 玩法：组队 PK 抢答 ----
  const qA1 = safe(waitFor(sa, 'room.quiz_question', { predicate: (p) => p.index === 0 }));
  const qB1 = safe(waitFor(sb, 'room.quiz_question', { predicate: (p) => p.index === 0 }));
  await req('POST', `/rooms/${roomId}/quiz/start`, { token: aTok });
  const [qa1, qb1] = await Promise.all([qA1, qB1]);
  ok('PK：A 看到中文题、B 看到西语题（同题本地化）', qa1.v?.prompt === '二加二等于几？' && qb1.v?.prompt === '¿Cuánto es 2 + 2?' && qa1.v?.questionId === qb1.v?.questionId, `a="${qa1.v?.prompt}" b="${qb1.v?.prompt}"`);
  // A 抢答正确(2+2=4 → 下标1) → 进第 2 题
  const qA2 = safe(waitFor(sa, 'room.quiz_question', { predicate: (p) => p.index === 1 }));
  await req('POST', `/rooms/${roomId}/quiz/answer`, { token: aTok, body: { questionId: qa1.v.questionId, choice: 1 } });
  const qa2 = await qA2;
  ok('PK：A 抢答对 → 推进到第 2 题', qa2.v?.index === 1, qa2.err ?? '');
  // A 再抢答对第 2 题（蓝色 → 下标1）→ 结算
  const resQA = safe(waitFor(sa, 'room.quiz_result', {}));
  const resQB = safe(waitFor(sb, 'room.quiz_result', {}));
  await req('POST', `/rooms/${roomId}/quiz/answer`, { token: aTok, body: { questionId: qa2.v.questionId, choice: 1 } });
  const [rqA] = await Promise.all([resQA, resQB]);
  ok('PK：结算 A 胜（20 分）', rqA.v?.winner?.userId === aId && rqA.v?.winner?.score === 20, rqA.err ?? `winner=${rqA.v?.winner?.displayName} score=${rqA.v?.winner?.score}`);

  // ---- 座位制：上麦申请 → 房主审批 ----
  const reqP = safe(waitFor(sa, 'room.mic_requests', { predicate: (p) => p.requests.some((r) => r.userId === bId) }));
  await req('POST', `/rooms/${roomId}/mic/apply`, { token: bTok, body: { seatIndex: 2 } });
  const reqs = await reqP;
  ok('座位：房主收到 B 的上麦申请（想坐2号）', reqs.v?.requests?.some((r) => r.userId === bId && r.seatIndex === 2), reqs.err ?? `reqs=${JSON.stringify(reqs.v?.requests)}`);
  const seatsP = safe(waitFor(sb, 'room.seats', { predicate: (p) => p.seats.some((s) => s.userId === bId) }));
  await req('POST', `/rooms/${roomId}/mic/approve`, { token: aTok, body: { userId: bId, seatIndex: 2 } });
  const seatsAfter = await seatsP;
  const bSeat = seatsAfter.v?.seats?.find((s) => s.userId === bId);
  ok('座位：A 同意后 B 坐到 2 号麦', bSeat?.index === 2, seatsAfter.err ?? `seat=${bSeat?.index}`);
  ok('座位：A 是房主占 0 号麦', seatsAfter.v?.seats?.[0]?.userId === aId && seatsAfter.v?.hostId === aId, `host=${seatsAfter.v?.hostId}`);
  // 非房主审批应被拒
  const badApprove = await req('POST', `/rooms/${roomId}/mic/approve`, { token: bTok, body: { userId: aId } });
  ok('座位：非房主审批被拒（NOT_HOST）', badApprove.status >= 400 && badApprove.json?.code === 'NOT_HOST', `status=${badApprove.status}`);

  // ---- 送礼扣费 + Telegram Stars（dev 入账）----
  const before = (await req('GET', '/wallet', { token: aTok })).json?.diamonds ?? 0;
  const rc = await req('POST', '/wallet/recharge/dev', { token: aTok, body: { packId: 'p4' } });
  ok('充值：dev 入账 +1300💎', rc.json?.diamonds === before + 1300, `diamonds=${rc.json?.diamonds}`);
  const giftBP = safe(waitFor(sb, 'room.gift', { predicate: (p) => p.fromUserId === aId }));
  const giftAP = safe(waitFor(sa, 'room.gift', { predicate: (p) => p.fromUserId === aId }));
  const giftRes = await req('POST', `/rooms/${roomId}/gift`, { token: aTok, body: { giftType: 'rocket', toUserId: bId } });
  const [gB, gA] = await Promise.all([giftBP, giftAP]);
  ok('送礼：B 收到广播（服务端定价 rocket=520，受赠B）', gB.v?.giftType === 'rocket' && gB.v?.coins === 520 && gB.v?.toUserId === bId, gB.err ?? `got=${JSON.stringify(gB.v)}`);
  ok('送礼：发送者本人也收到（用于飘屏/连击）', gA.v?.fromUserId === aId, gA.err ?? '');
  ok('送礼：扣费后余额 = 充值后-520', giftRes.json?.balance === before + 1300 - 520, `balance=${giftRes.json?.balance}`);
  // 余额不足 → 402（B 余额为 0 时校验，否则跳过）
  const bBal = (await req('GET', '/wallet', { token: bTok })).json?.diamonds ?? 0;
  if (bBal < 1) {
    const poor = await req('POST', `/rooms/${roomId}/gift`, { token: bTok, body: { giftType: 'rose' } });
    ok('送礼：余额不足返回 402 INSUFFICIENT_DIAMONDS', poor.status === 402 && poor.json?.code === 'INSUFFICIENT_DIAMONDS', `status=${poor.status} code=${poor.json?.code}`);
  } else {
    ok('送礼：余额不足校验（跳过，B 余额>0）', true);
  }

  sa.close(); sb.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exitCode = fail ? 1 : 0;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
