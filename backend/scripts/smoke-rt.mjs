// Realtime smoke test: WS signaling + translation. Requires a running backend.
// Verifies AC-CALL-1, AC-XLATE-1/2, paywall (AC-PAY-1) + concurrency (AC-PAY-3), AC-REL-1.
// Run: node scripts/smoke-rt.mjs
import { io } from 'socket.io-client';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const AGENT_TOKEN = process.env.AGENT_INGRESS_TOKEN ?? 'dev_agent_token';
let pass = 0,
  fail = 0;
const ok = (name, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log(`${cond ? '✅' : '❌'} ${name}${extra ? '  — ' + extra : ''}`);
};

async function req(method, path, { token, body, agent } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(agent ? { 'x-agent-token': AGENT_TOKEN } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, json };
}
const login = (mockUserId) => req('POST', '/auth/hellotalk/callback', { body: { mockUserId } });

function connect(token) {
  const s = io(BASE, { path: '/ws', transports: ['websocket'], auth: { token } });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('ws connect timeout')), 5000);
    s.on('connect', () => {
      clearTimeout(t);
      resolve(s);
    });
    s.on('connect_error', (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}
function waitFor(socket, event, { timeout = 8000, predicate } = {}) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timeout waiting for ${event}`));
    }, timeout);
    function handler(payload) {
      if (!predicate || predicate(payload)) {
        clearTimeout(t);
        socket.off(event, handler);
        resolve(payload);
      }
    }
    socket.on(event, handler);
  });
}
const safe = (p) => p.then((v) => ({ v }), (e) => ({ err: e.message }));

async function main() {
  console.log(`\n=== LinkU realtime smoke @ ${BASE} ===\n`);
  const male = (await login('seed_male_01')).json;
  const female = (await login('seed_female_01')).json;
  await req('POST', '/presence/heartbeat', { token: male.token, body: { availableForCall: true } });
  await req('POST', '/presence/heartbeat', { token: female.token, body: { availableForCall: true } });

  const ms = await connect(male.token);
  const fs = await connect(female.token);
  ok('two WS clients connected', ms.connected && fs.connected);

  // ---- AC-CALL-1: signaling ----
  const incomingP = safe(waitFor(fs, 'incoming_call', { predicate: (p) => p.caller?.id === male.user.id }));

  const created = await req('POST', '/calls', { token: male.token, body: { calleeId: female.user.id, mode: 'VIDEO' } });
  ok('POST /calls returns callId+room+token', created.status < 300 && !!created.json?.callId && !!created.json?.room, `room=${created.json?.room} ${created.json?.code ?? ''}`);
  const callId = created.json.callId;

  const incoming = await incomingP;
  ok('AC-CALL-1 callee receives incoming_call', incoming.v?.callId === callId && incoming.v?.caller?.id === male.user.id, incoming.err ?? `mode=${incoming.v?.mode}`);

  const acceptedP = safe(waitFor(ms, 'call_accepted', { predicate: (p) => p.callId === callId }));
  // start XLATE listeners BEFORE accept so we don't miss the first events
  const capP = safe(waitFor(ms, 'caption', { timeout: 9000, predicate: (p) => p.callId === callId && p.originalText && p.translatedText }));
  const stateP = safe(waitFor(ms, 'translation.state', { predicate: (p) => p.callId === callId && p.state === 'active' }));

  const accepted = await req('POST', `/calls/${callId}/accept`, { token: female.token });
  ok('POST /accept returns token+room', accepted.status < 300 && !!accepted.json?.room);
  const accEvt = await acceptedP;
  ok('AC-CALL-1 caller receives call_accepted', accEvt.v?.callId === callId, accEvt.err ?? '');

  // ---- AC-XLATE-1: streaming bilingual captions + active state ----
  const cap = await capP;
  ok('AC-XLATE-1 bilingual caption streams (<=9s)', !!cap.v, cap.err ?? `"${cap.v?.originalText}" -> "${cap.v?.translatedText}"`);
  const st = await stateP;
  ok('AC-XLATE-1 translation.state active w/ trial left', st.v?.state === 'active' && typeof st.v?.translatedSecLeft === 'number', st.err ?? `left=${st.v?.translatedSecLeft}`);

  // ---- AC-XLATE-2: degrade on injected failure, call continues ----
  const degP = safe(waitFor(ms, 'translation.state', { predicate: (p) => p.callId === callId && p.state === 'degraded' }));
  await req('POST', '/internal/translation/fault', { agent: true, body: { callId, fault: 'fail' } });
  const deg = await degP;
  ok('AC-XLATE-2 degrades to subtitle-mode on failure', deg.v?.state === 'degraded', deg.err ?? '');
  await req('POST', '/internal/translation/fault', { agent: true, body: { callId, fault: 'none' } });

  // ---- AC-PAY-3: second concurrent call rejected ----
  const second = await req('POST', '/calls', { token: male.token, body: { calleeId: female.user.id, mode: 'VIDEO' } });
  ok('AC-PAY-3 concurrent call rejected (409)', second.status === 409, `code=${second.json?.code}`);

  // ---- AC-PAY-1: exhaust trial via agent ingress -> paywall, call continues ----
  const paywallP = safe(waitFor(ms, 'translation.paywall', { predicate: (p) => p.callId === callId }));
  await req('POST', '/internal/agent/report', { agent: true, body: { callId, speakerId: male.user.id, seconds: 1000, originalText: 'hello', translatedText: '你好' } });
  const pw = await paywallP;
  ok('AC-PAY-1 paywall fires when trial exhausted', pw.v?.reason === 'trial_exhausted', pw.err ?? '');

  // ---- AC-PAY-2: subscribe -> translation resumes to active ----
  const resumeP = safe(waitFor(ms, 'translation.state', { predicate: (p) => p.callId === callId && p.state === 'active' }));
  const sub = await req('POST', '/iap/verify', { token: male.token, body: { receipt: 'mock_month' } });
  const resumed = await resumeP;
  ok('AC-PAY-2 subscription resumes translation', sub.json?.subscriptionTier === 'MONTHLY' && resumed.v?.state === 'active', `tier=${sub.json?.subscriptionTier} left=${resumed.v?.translatedSecLeft}`);

  // ---- gift: buy diamonds, send gift -> peer receives gift_received ----
  await req('POST', '/iap/verify', { token: male.token, body: { receipt: 'mock_diamonds_100' } });
  const giftP = safe(waitFor(fs, 'gift_received', { predicate: (p) => p.callId === callId }));
  const gift = await req('POST', `/calls/${callId}/gift`, { token: male.token, body: { giftType: 'rose' } });
  const giftEvt = await giftP;
  ok('gift deducts diamonds + peer receives gift_received', gift.status < 300 && gift.json?.wallet?.diamonds === 99 && giftEvt.v?.giftType === 'rose', `diamonds=${gift.json?.wallet?.diamonds}`);

  // ---- AC-SAFE-1: fraud phrase in caption -> risk_warning ----
  const riskP = safe(waitFor(fs, 'risk_warning', { predicate: (p) => p.callId === callId }));
  await req('POST', '/internal/agent/report', { agent: true, body: { callId, speakerId: female.user.id, seconds: 0, originalText: 'invest with me', translatedText: '我带你投资，稳赚不亏' } });
  const risk = await riskP;
  ok('AC-SAFE-1 risk_warning on scam phrase', risk.v?.riskType === 'crypto_investment' && (risk.v?.level === 'high' || risk.v?.level === 'medium'), risk.err ?? `type=${risk.v?.riskType}`);

  // ---- AC-REL-1: end call -> history has duration + translatedSec ----
  const ended = await req('POST', `/calls/${callId}/end`, { token: male.token, body: { reason: 'smoke' } });
  ok('POST /end returns duration+translatedSec', ended.status < 300 && typeof ended.json?.translatedSec === 'number', `dur=${ended.json?.durationSec} xlated=${ended.json?.translatedSec}`);
  const hist = await req('GET', '/calls/history', { token: male.token });
  const row = (hist.json ?? []).find((c) => c.id === callId);
  ok('AC-REL-1 history row has durationSec + translatedSec', !!row && row.translatedSec >= 0 && row.status === 'ENDED', `status=${row?.status} xlated=${row?.translatedSec}`);

  ms.disconnect();
  fs.disconnect();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exitCode = fail ? 1 : 0;
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
