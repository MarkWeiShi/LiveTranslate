import crypto from 'node:crypto';

export interface VerifyResult {
  ok: boolean;
  reason?: 'no_bot_token' | 'no_hash' | 'bad_hash' | 'no_auth_date' | 'expired';
}

/**
 * 校验 Telegram Mini App `initData` 的真实性（Telegram 官方 HMAC-SHA256 算法）。
 * 仅服务端使用（需 bot token）——app 永不校验，故此文件放 backend、不进 H5 包。
 *
 *   secret           = HMAC_SHA256(key="WebAppData", data=botToken)
 *   expectedHash     = hex( HMAC_SHA256(key=secret, data=dataCheckString) )
 *   dataCheckString  = 除 hash/signature 外所有字段，按 key 升序，`k=v` 以 "\n" 连接（值为解码后原文）
 *
 * 通过 timingSafeEqual 防时序侧信道；可选 maxAgeSec 拒绝过期 initData（防重放）。
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  opts: { maxAgeSec?: number; now?: number } = {},
): VerifyResult {
  if (!botToken) return { ok: false, reason: 'no_bot_token' };

  const params = new URLSearchParams(initData ?? '');
  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'no_hash' };

  const entries: string[] = [];
  for (const [k, v] of params.entries()) {
    if (k === 'hash' || k === 'signature') continue;
    entries.push(`${k}=${v}`);
  }
  entries.sort();
  const dataCheckString = entries.join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_hash' };
  }

  if (opts.maxAgeSec != null) {
    const authDate = Number(params.get('auth_date'));
    if (!Number.isFinite(authDate)) return { ok: false, reason: 'no_auth_date' };
    const now = opts.now ?? Math.floor(Date.now() / 1000);
    if (now - authDate > opts.maxAgeSec) return { ok: false, reason: 'expired' };
  }

  return { ok: true };
}
