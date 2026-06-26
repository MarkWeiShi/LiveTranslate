import { api } from '@/api/endpoints';
import { parseUtmParams, type AttributionBody } from '@linku/shared';

// 启动归因来源（按优先级）：
//  1) Telegram Mini App：window.Telegram.WebApp.initData 或 URL hash 的 tgWebAppData（可服务端校验）
//  2) 外链 UTM：x / messenger / instagram 等投放链接 ?utm_source=x&utm_campaign=...&ref=inv42
// 用 globalThis 访问，避免依赖 DOM lib（RN 原生无 window/location，安全降级）。
type TgWebApp = { initData?: string; ready?: () => void };
type GlobalLike = {
  Telegram?: { WebApp?: TgWebApp };
  location?: { hash?: string; search?: string };
};
function g(): GlobalLike {
  return globalThis as unknown as GlobalLike;
}

function readLaunch(): AttributionBody | undefined {
  // 1) Telegram
  const fromSdk = g().Telegram?.WebApp?.initData;
  const hash = g().location?.hash ?? '';
  const tgFromHash = hash.length > 1 ? new URLSearchParams(hash.slice(1)).get('tgWebAppData') : null;
  const initData = fromSdk || tgFromHash || undefined;
  if (initData) return { tgWebAppData: initData };

  // 2) UTM 外链
  const search = g().location?.search ?? '';
  const utm = parseUtmParams(search);
  if (utm.source || utm.ref || utm.campaign) {
    return { source: utm.source, utm };
  }
  return undefined;
}

let reported = false;

/**
 * H5 启动归因：fire-and-forget、只跑一次、失败静默——绝不阻塞主流程。
 * 信任判定以后端 `verified` 为准（仅 telegram 真实模式做 HMAC 校验；外链不可校验）。
 */
export async function reportTelegramLaunch(): Promise<void> {
  if (reported) return;
  reported = true;
  const body = readLaunch();
  if (!body) return;
  try {
    g().Telegram?.WebApp?.ready?.();
    await api.reportAttribution(body);
  } catch {
    /* 归因失败不影响主流程 */
  }
}
