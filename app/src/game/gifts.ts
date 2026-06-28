// 礼物目录（BIGO 式）。coins≥BIG_GIFT 视为大礼物 → 全屏特效。
export interface GiftDef { type: string; emoji: string; coins: number; name: string }

export const GIFTS: GiftDef[] = [
  { type: 'rose', emoji: '🌹', coins: 1, name: '玫瑰' },
  { type: 'beer', emoji: '🍺', coins: 9, name: '啤酒' },
  { type: 'love', emoji: '❤️', coins: 66, name: '爱心' },
  { type: 'crown', emoji: '👑', coins: 199, name: '皇冠' },
  { type: 'rocket', emoji: '🚀', coins: 520, name: '火箭' },
  { type: 'castle', emoji: '🏰', coins: 1314, name: '城堡' },
];

export const BIG_GIFT_COINS = 199;
export function giftEmoji(type: string): string {
  return GIFTS.find((g) => g.type === type)?.emoji ?? '🎁';
}
