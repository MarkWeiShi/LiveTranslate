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

  // block exclusion (both directions) + /users/:id blocked flag
  await req('POST', '/blocks', { token: maleTok, body: { blockedUserId: f2Id } });
  const discAfterBlock = await req('GET', '/discovery?gender=FEMALE&onlineOnly=true', { token: maleTok });
  const idsB = (discAfterBlock.json ?? []).map((c) => c.id);
  ok('blocked user excluded from discovery', !idsB.includes(f2Id) && idsB.includes(f1Id));
  const detail = await req('GET', `/users/${f2Id}`, { token: maleTok });
  ok('/users/:id shows blocked=true for blocked peer', detail.json?.blocked === true);
  const blockList = await req('GET', '/blocks', { token: maleTok });
  const blockId = (blockList.json ?? []).find((b) => b.blockedUserId === f2Id)?.id;
  await req('DELETE', `/blocks/${blockId}`, { token: maleTok }); // restore for later milestones

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exitCode = fail ? 1 : 0;
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
