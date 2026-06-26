// LOOP-R6 成长体系冒烟（运行中的 :3000）：积分/等级、CP 亲密度、家族战排行。
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

async function main() {
  console.log(`\n=== Growth smoke @ ${BASE} ===\n`);
  const a = await login('seed_male_01');
  const b = await login('seed_female_01');
  const aTok = a.json.token, bTok = b.json.token, bId = b.json.user.id;

  // 积分/等级
  const aw = await req('POST', '/growth/award', { token: aTok, body: { amount: 120, reason: 'quiz_win' } });
  ok('积分：+120 → 等级 2 + leveledUp', aw.json?.xp === 120 && aw.json?.level === 2 && aw.json?.leveledUp === true, `xp=${aw.json?.xp} lvl=${aw.json?.level}`);
  const me = await req('GET', '/growth/me', { token: aTok });
  ok('积分：GET /growth/me 反映', me.json?.level === 2 && me.json?.toNext === 80, `toNext=${me.json?.toNext}`);

  // CP 亲密度
  await req('POST', '/growth/bond', { token: aTok, body: { peerId: bId, amount: 30 } });
  const bond2 = await req('POST', '/growth/bond', { token: aTok, body: { peerId: bId, amount: 20 } });
  ok('CP：亲密度累加到 50', bond2.json?.intimacy === 50, `intimacy=${bond2.json?.intimacy}`);
  // 反向查询（B 看 A）应一致（pair 归一化）
  const bondRev = await req('GET', `/growth/bond/${a.json.user.id}`, { token: bTok });
  ok('CP：双向一致（pair 归一化）', bondRev.json?.intimacy === 50, `rev=${bondRev.json?.intimacy}`);

  // 家族战
  const fam1 = await req('POST', '/families', { token: aTok, body: { name: 'Dragons' } });
  const famId = fam1.json?.id;
  ok('家族：创建并自动入会', !!famId && fam1.json?.members === 1, `members=${fam1.json?.members}`);
  await req('POST', `/families/${famId}/contribute`, { token: aTok, body: { amount: 100 } });
  const fam2 = await req('POST', '/families', { token: bTok, body: { name: 'Tigers' } });
  await req('POST', `/families/${fam2.json.id}/contribute`, { token: bTok, body: { amount: 40 } });
  const lb = await req('GET', '/families/leaderboard', { token: aTok });
  const top = lb.json?.families?.[0];
  ok('家族：排行榜 Dragons 居首（100>40）', top?.name === 'Dragons' && top?.score === 100, `top=${top?.name}:${top?.score}`);
  // 非成员不能贡献
  const bad = await req('POST', `/families/${famId}/contribute`, { token: bTok, body: { amount: 999 } });
  ok('家族：非成员贡献被拒(400)', bad.status === 400, `status=${bad.status}`);

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exitCode = fail ? 1 : 0;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
