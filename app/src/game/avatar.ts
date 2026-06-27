// DiceBear notionists 头像（移植自 wolfcha avatar-config.ts）。免费免鉴权 HTTP 直出 SVG，
// RN-web <Image> 直接可用。lip-sync 的核心是切换 lips 参数。
const DICEBEAR = 'https://api.dicebear.com/7.x/notionists/svg';

// 说话时交替的嘴型；静止用其一。
export const TALK_LIPS = ['variant04', 'variant11'] as const;
export const IDLE_LIPS = 'variant10';

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const BG = ['c5a059', '8a1c1c', '4a90e2', '9b59b6', 'd35400', '276749', '8a7866'];

export interface AvatarOpts {
  lips?: string;
  backgroundColor?: string; // 'transparent' 或 6 位 hex（无 #）
}

export function avatarUrl(seed: string, opts: AvatarOpts = {}): string {
  const p = new URLSearchParams();
  p.set('seed', seed);
  p.set('backgroundColor', opts.backgroundColor ?? BG[hash(seed) % BG.length]);
  if (opts.lips) p.set('lips', opts.lips);
  p.set('beardProbability', '0');
  return `${DICEBEAR}?${p.toString()}`;
}
