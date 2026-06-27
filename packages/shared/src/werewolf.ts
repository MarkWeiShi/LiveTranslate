// 跨语言狼人杀（Cross-Language Werewolf）契约 —— 见 ops/PRD_跨语言狼人杀.md。
// 设计要点：①回合制单麦发言天然适配实时翻译；②AI 主持=流程裁判+多语言旁白+冷启兜底；
// ③私密信息（角色/查验/夜间行动）按角色权限分端下发，永不进入公共 STATE（通道隔离 E7-1）；
// ④房间级披露含 AI，但对局中不暴露具体哪位是 AI（赛后 GAME_OVER 才揭示）。

// ---- Server -> Client WS 事件 ----
export const WEREWOLF_EVENTS = {
  STATE: 'wolf.state', // 公共状态（全员一致，无隐藏信息）
  ROLE: 'wolf.role', // 私密：你的角色（仅本人）
  PRIVATE: 'wolf.private', // 私密：夜间行动提示 / 查验结果 / 个人通知（仅本人，已本地化）
  HOST: 'wolf.host', // AI 主持旁白（按接收者母语本地化）
  SPEECH: 'wolf.speech', // 发言字幕（发言者母语→接收者母语，身份盲翻译）
  FX: 'wolf.fx', // 夜间技能特效（后端按可见性下发：狼→狼队、预言家→本人、女巫→本人、猎人→全场）
  GAME_OVER: 'wolf.game_over', // 结算 + 全角色/AI 揭示
} as const;

// 夜间特效类型（与前端 NightFx 对应）。后端只发给"有权看到"的人，保证不泄密。
export type WolfFxType = 'wolf' | 'heal' | 'seer' | 'poison' | 'hunter';
export interface WolfFxPayload {
  gameId: string;
  type: WolfFxType;
  ts: number;
}

export type WolfRole = 'WOLF' | 'SEER' | 'WITCH' | 'HUNTER' | 'VILLAGER';
export type WolfCamp = 'WOLF' | 'GOOD';
export type WolfPhase = 'lobby' | 'night' | 'dawn' | 'speak' | 'vote' | 'over';
export type WolfActionType = 'WOLF_KILL' | 'SEER_CHECK' | 'WITCH' | 'HUNTER_SHOT';

export interface WolfBoard {
  key: string;
  name: string;
  size: number;
  roles: WolfRole[]; // 长度 === size
}

// 首期两块板（PRD §3.1）
export const WEREWOLF_BOARDS: Record<string, WolfBoard> = {
  newbie6: {
    key: 'newbie6',
    name: '新手 6 人',
    size: 6,
    roles: ['WOLF', 'WOLF', 'SEER', 'WITCH', 'VILLAGER', 'VILLAGER'],
  },
  standard9: {
    key: 'standard9',
    name: '标准 9 人',
    size: 9,
    roles: ['WOLF', 'WOLF', 'WOLF', 'SEER', 'WITCH', 'HUNTER', 'VILLAGER', 'VILLAGER', 'VILLAGER'],
  },
};

/** 公共座位信息：对局中绝不含 role / isAI（避免泄漏，破坏推理）。 */
export interface WolfSeatPublic {
  seatNo: number;
  userId: string | null;
  displayName: string;
  alive: boolean;
  filled: boolean;
}

export interface WolfStatePayload {
  gameId: string;
  boardKey: string;
  boardName: string;
  phase: WolfPhase;
  day: number; // 第几个白天（从 1 起）
  hostUserId: string;
  containsAI: boolean; // 房间级 AI 披露
  started: boolean;
  seats: WolfSeatPublic[];
  currentSpeakerSeat: number | null;
  deadlineTs: number | null; // 当前阶段/发言倒计时（毫秒时间戳）
  alivePlayers: number;
  voteTally?: { seatNo: number; votes: number }[]; // 投票阶段展示
}

export interface WolfRolePayload {
  gameId: string;
  seatNo: number;
  role: WolfRole;
  camp: WolfCamp;
  roleName: string; // 已本地化
  roleDesc: string; // 已本地化
  teammates?: { seatNo: number; displayName: string }[]; // 狼互相可见
}

export type WolfPrivateKind = 'night_action' | 'seer_result' | 'notice' | 'hunter_shot';
export interface WolfPrivatePayload {
  gameId: string;
  kind: WolfPrivateKind;
  text: string; // 已本地化
  action?: WolfActionType; // 行动类提示
  targets?: { seatNo: number; displayName: string }[]; // 可选目标
  canSave?: boolean; // 女巫：可用解药
  canPoison?: boolean; // 女巫：可用毒药
  victimSeat?: number | null; // 女巫可见：今晚被刀者
  deadlineTs?: number;
}

export interface WolfHostPayload {
  gameId: string;
  text: string; // 已本地化旁白
  ts: number;
}

/** 发言字幕：单麦发言阶段，把发言者母语一句话翻成接收者母语（身份盲）。 */
export interface WolfSpeechPayload {
  gameId: string;
  fromSeat: number;
  fromName: string;
  originalText: string;
  originalLang: string;
  translatedText: string;
  targetLang: string;
  ts: number;
}

export interface WolfRevealEntry {
  seatNo: number;
  displayName: string;
  role: WolfRole;
  isAI: boolean;
  alive: boolean;
}
export interface WolfGameOverPayload {
  gameId: string;
  winner: WolfCamp;
  reveal: WolfRevealEntry[]; // 赛后才揭示角色与 AI 身份
}

// ---- REST 契约 ----
export interface WolfCreateBody {
  boardKey?: string; // 缺省 newbie6
  language?: string;
}
export interface WolfJoinBody {
  language?: string;
}
export interface WolfNightActionBody {
  action: WolfActionType;
  targetSeat?: number; // WOLF_KILL / SEER_CHECK / HUNTER_SHOT / 女巫毒
  save?: boolean; // 女巫解药
  poisonSeat?: number; // 女巫毒药目标
}
export interface WolfSpeakBody {
  text: string;
}
export interface WolfVoteBody {
  targetSeat?: number | null; // 省略/null = 弃票
}
export interface WolfCreateResponse {
  gameId: string;
  room: string;
  token: string;
  boardKey: string;
}
export interface WolfJoinResponse {
  gameId: string;
  room: string;
  token: string;
}
