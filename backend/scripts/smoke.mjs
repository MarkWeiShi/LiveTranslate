// End-to-end smoke test against a running backend (default http://localhost:3000).
// Verifies acceptance criteria headlessly. Run: node scripts/smoke.mjs
const BASE = process.env.BASE ?? 'http://localhost:3000';
let pass = 0,
  fail = 0;
const ok = (name, cond, extra = '') => {
  (cond ? pass++ : fail++);
  console.log(`${cond ? '✅' : '❌'} ${name}${extra ? '  — ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty */
  }
  return { status: res.status, json };
}
const login = (mockUserId) =>
  req('POST', '/auth/hellotalk/callback', { body: { mockUserId } });

async function main() {
  console.log(`\n=== LinkU smoke test @ ${BASE} ===\n`);

  // ---------- M1: AUTH ----------
  const a1 = await login('seed_male_01');
  ok(
    'AC-AUTH-1 login imports profile',
    a1.status < 300 &&
      a1.json?.token &&
      a1.json.user.nativeLanguage === 'zh' &&
      a1.json.user.gender === 'MALE' &&
      a1.json.user.realPersonVerified === true,
    `native=${a1.json?.user?.nativeLanguage} gender=${a1.json?.user?.gender} verified=${a1.json?.user?.realPersonVerified}`,
  );
  const maleTok = a1.json.token;
  const maleId = a1.json.user.id;

  const me = await req('GET', '/users/me', { token: maleTok });
  ok(
    '/users/me returns wallet',
    me.status === 200 && me.json?.wallet?.trialSecondsLeft === 420,
    `trial=${me.json?.wallet?.trialSecondsLeft} tier=${me.json?.wallet?.subscriptionTier}`,
  );

  const a2 = await login('seed_male_01');
  ok(
    'AC-AUTH-2 re-login no duplicate',
    a2.json?.user?.id === maleId && a2.json?.isNewUser === false,
    `sameId=${a2.json?.user?.id === maleId}`,
  );

  const bad = await login('does_not_exist');
  ok('unknown mock user → 401', bad.status === 401);

  // ---------- M2: DISCOVERY + PRESENCE ----------
  const f1 = await login('seed_female_01');
  const f2 = await login('seed_female_02');
  const f3 = await login('seed_female_03');
  const f1Tok = f1.json.token,
    f2Tok = f2.json.token,
    f3Tok = f3.json.token;
  const f1Id = f1.json.user.id,
    f2Id = f2.json.user.id;
  // bring f1 + f2 online (available); leave f3 offline
  await req('POST', '/presence/heartbeat', { token: f1Tok, body: { availableForCall: true } });
  await req('POST', '/presence/heartbeat', { token: f2Tok, body: { availableForCall: true } });
  await req('POST', '/presence/heartbeat', { token: maleTok, body: { availableForCall: true } });

  const disc = await req('GET', '/discovery?gender=FEMALE&onlineOnly=true', { token: maleTok });
  const ids = (disc.json ?? []).map((c) => c.id);
  ok(
    'AC-DISC-1 only online females, verified>trust order',
    disc.status === 200 &&
      ids.length >= 2 &&
      ids[0] === f1Id /* trust 85 */ &&
      ids[1] === f2Id /* trust 60 */ &&
      (disc.json ?? []).every((c) => c.gender === 'FEMALE' && c.online),
    `order=${ids.slice(0, 3).join(',')}`,
  );
  ok(
    'AC-DISC-1 offline female_03 excluded under onlineOnly',
    !ids.includes(f3.json.user.id),
  );

  // ---- AC-SAFE-2: report + block -> discovery excludes + re-call rejected ----
  const report = await req('POST', '/reports', { token: maleTok, body: { targetId: f2Id, reason: 'SCAM_FRAUD', detail: 'smoke' } });
  ok('AC-SAFE-2 report persists (201)', report.status === 201 && !!report.json?.id);

  await req('POST', '/blocks', { token: maleTok, body: { blockedUserId: f2Id } });
  const discAfterBlock = await req('GET', '/discovery?gender=FEMALE&onlineOnly=true', { token: maleTok });
  const idsB = (discAfterBlock.json ?? []).map((c) => c.id);
  ok('AC-SAFE-2 blocked user excluded from discovery', !idsB.includes(f2Id) && idsB.includes(f1Id));
  const detail = await req('GET', `/users/${f2Id}`, { token: maleTok });
  ok('AC-SAFE-2 /users/:id shows blocked=true', detail.json?.blocked === true);
  const recall = await req('POST', '/calls', { token: maleTok, body: { calleeId: f2Id, mode: 'VIDEO' } });
  ok('AC-SAFE-2 re-call blocked peer rejected (403)', recall.status === 403, `code=${recall.json?.code}`);
  const blockList = await req('GET', '/blocks', { token: maleTok });
  const blockId = (blockList.json ?? []).find((b) => b.blockedUserId === f2Id)?.id;
  await req('DELETE', `/blocks/${blockId}`, { token: maleTok }); // restore for later milestones

  // ---- M7: friends add + list ----
  const addF = await req('POST', '/friends', { token: maleTok, body: { friendId: f1Id } });
  ok('friend add returns friend card', addF.status < 300 && addF.json?.id === f1Id && !!addF.json?.friendshipId);
  const friends = await req('GET', '/friends', { token: maleTok });
  ok('friends list includes added friend', (friends.json ?? []).some((f) => f.id === f1Id));

  // ---- M8: Telegram 获客归因（LOOP-L2，mock）----
  const tgUser = encodeURIComponent(JSON.stringify({ id: 777001, username: 'smoke_tg', language_code: 'zh' }));
  const tgInit = `query_id=AAA&user=${tgUser}&auth_date=1719300000&start_param=ref_smoke&hash=mock`;
  const attr = await req('POST', '/attribution', { body: { tgWebAppData: tgInit } });
  ok(
    'LOOP-L2 attribution records telegram source + startParam',
    attr.status === 201 && attr.json?.source === 'telegram' && attr.json?.externalId === '777001' && attr.json?.startParam === 'ref_smoke',
    `source=${attr.json?.source} ext=${attr.json?.externalId} start=${attr.json?.startParam}`,
  );
  const AGENT = process.env.AGENT_INGRESS_TOKEN ?? 'dev_agent_token';
  const cntRes = await fetch(BASE + '/internal/attribution/count?source=telegram', { headers: { 'x-agent-token': AGENT } });
  const cnt = await cntRes.json().catch(() => null);
  ok('LOOP-L2 internal count reflects recorded telegram attribution', cntRes.status === 200 && (cnt?.count ?? 0) >= 1, `count=${cnt?.count}`);
  const guarded = await fetch(BASE + '/internal/attribution/count?source=telegram'); // no token
  ok('LOOP-L2 internal count is agent-token guarded (401 without token)', guarded.status === 401);

  // ---- M9: 多渠道归因 + 漏斗（x / messenger / instagram，UTM 外链）----
  for (const [src, ch] of [['twitter', 'x'], ['fb', 'messenger'], ['ig', 'instagram']]) {
    const r = await req('POST', '/attribution', { body: { source: src, utm: { source: src, campaign: 'launch', ref: 'inv_' + ch } } });
    ok(`multichannel attribution ${src} → channel=${ch}`, r.status === 201 && r.json?.channel === ch && r.json?.ref === 'inv_' + ch, `ch=${r.json?.channel} ref=${r.json?.ref}`);
  }
  // x 渠道补 signup + activate，构成完整漏斗
  await req('POST', '/attribution/event', { body: { channel: 'x', ref: 'inv_x', stage: 'signup' } });
  await req('POST', '/attribution/event', { body: { channel: 'x', ref: 'inv_x', stage: 'activate' } });
  const funRes = await fetch(BASE + '/internal/attribution/funnel', { headers: { 'x-agent-token': AGENT } });
  const fun = await funRes.json().catch(() => null);
  const xRow = (fun?.channels ?? []).find((c) => c.channel === 'x');
  ok('funnel: x 渠道 land/signup/activate 齐全且转化率算出', funRes.status === 200 && xRow && xRow.land >= 1 && xRow.signup >= 1 && xRow.activate >= 1 && typeof xRow.signupRate === 'number',
    xRow ? `x land=${xRow.land} signup=${xRow.signup} activate=${xRow.activate} sRate=${xRow.signupRate}` : 'no x row');
  const funGuard = await fetch(BASE + '/internal/attribution/funnel'); // no token
  ok('funnel internal is agent-token guarded (401)', funGuard.status === 401);

  // ---- M10: Telegram 自动登录（mock 模式不校验 hash）----
  const tgu = encodeURIComponent(JSON.stringify({ id: 700700, username: 'tg_login', language_code: 'zh' }));
  const tgLogin = await req('POST', '/auth/telegram', { body: { tgWebAppData: `user=${tgu}&auth_date=1719300000&hash=mock` } });
  ok('Telegram 自动登录 → token + 用户(母语 zh)', tgLogin.status < 300 && !!tgLogin.json?.token && tgLogin.json?.user?.nativeLanguage === 'zh', `lang=${tgLogin.json?.user?.nativeLanguage}`);

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exitCode = fail ? 1 : 0;
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
