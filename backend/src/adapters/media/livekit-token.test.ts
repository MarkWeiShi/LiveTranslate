// LOOP-R2: LiveKit token 签发离线单测。
// 用【假】API key/secret 签发并自验——无需真实 LiveKit 服务，证明 token 结构与签名正确。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TokenVerifier } from 'livekit-server-sdk';
import { LiveKitMediaTransport } from './livekit-media.transport';

const KEY = 'devkey';
const SECRET = 'dev_secret_at_least_32_chars_long_000';

test('mints a valid join token (verifiable with the same secret, no real server)', async () => {
  process.env.LIVEKIT_API_KEY = KEY;
  process.env.LIVEKIT_API_SECRET = SECRET;
  const lk = new LiveKitMediaTransport();
  const handle = await lk.createRoom('abc');
  const jwt = await lk.mintToken('user_42', handle.room);

  const claims = await new TokenVerifier(KEY, SECRET).verify(jwt);
  assert.equal(claims.sub, 'user_42'); // identity → JWT sub
  assert.equal(claims.video?.room, 'lk_abc');
  assert.equal(claims.video?.roomJoin, true);
  assert.equal(claims.video?.canPublish, true);
});

test('wrong secret fails verification', async () => {
  process.env.LIVEKIT_API_KEY = KEY;
  process.env.LIVEKIT_API_SECRET = SECRET;
  const jwt = await new LiveKitMediaTransport().mintToken('u', 'lk_x');
  await assert.rejects(() => new TokenVerifier(KEY, 'WRONG_secret_at_least_32_chars_0000').verify(jwt));
});

test('missing creds → LIVEKIT_NOT_CONFIGURED', async () => {
  delete process.env.LIVEKIT_API_KEY;
  delete process.env.LIVEKIT_API_SECRET;
  await assert.rejects(() => new LiveKitMediaTransport().mintToken('u', 'r'), /LIVEKIT_API_KEY/);
});
