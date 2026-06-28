// 礼物目录 + Telegram Stars 充值包（前后端共用，后端按此权威定价，防止客户端伪造金额）。

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
export const ROOM_GIFT_PRICE: Record<string, number> = Object.fromEntries(GIFTS.map((g) => [g.type, g.coins]));
export function giftEmoji(type: string): string {
  return GIFTS.find((g) => g.type === type)?.emoji ?? '🎁';
}

// Telegram Stars 充值包：stars = 支付的星星数（XTR），diamonds = 到账钻石数。
export interface StarPack { id: string; stars: number; diamonds: number; label: string }
export const STAR_PACKS: StarPack[] = [
  { id: 'p1', stars: 50, diamonds: 50, label: '50 钻' },
  { id: 'p2', stars: 100, diamonds: 110, label: '110 钻' },
  { id: 'p3', stars: 300, diamonds: 350, label: '350 钻' },
  { id: 'p4', stars: 1000, diamonds: 1300, label: '1300 钻' },
];

export interface RechargeBody { packId: string }
export interface RechargeResponse { mode: 'stars' | 'mock'; invoiceLink?: string }

// 收礼收益：受赠方按比例获得可提现收益。
export const GIFT_EARN_RATE = 0.7;
export interface WithdrawBody { amount: number }
