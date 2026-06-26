// 成长体系契约：个人积分/等级、跨国 CP 亲密度、家族战。留存与付费层。

/** 升级规则（纯函数，单一数据源）：每 100 XP 升 1 级，L1 起。 */
export function levelFromXp(xp: number): number {
  return Math.floor(Math.max(0, xp) / 100) + 1;
}
/** 距下一级还差多少 XP。 */
export function xpToNextLevel(xp: number): number {
  const next = levelFromXp(xp) * 100;
  return Math.max(0, next - Math.max(0, xp));
}

export interface GrowthProfileDto {
  userId: string;
  xp: number;
  level: number;
  toNext: number;
}
export interface AwardXpBody { amount: number; reason?: string; }
export interface AwardXpResult extends GrowthProfileDto { leveledUp: boolean; }

// 跨国 CP（双人亲密度）
export interface BondBody { peerId: string; amount?: number; }
export interface BondDto {
  peerId: string;
  intimacy: number;
  level: number; // 亲密度等级，同样 100/级
}

// 家族战
export interface CreateFamilyBody { name: string; }
export interface ContributeBody { amount: number; }
export interface FamilyDto {
  id: string;
  name: string;
  score: number;
  members: number;
}
export interface FamilyLeaderboardDto {
  families: FamilyDto[];
}
