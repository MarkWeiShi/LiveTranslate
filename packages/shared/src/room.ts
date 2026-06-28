// 巴别塔语聊房（Babel Room）契约：N 人房间（MVP 先 2 人），每人说母语、各自看到自己语言的字幕。
// 复用翻译三明治的 MT 段（TranslationEngine.translate）+ 实时 WS 扇出字幕。MVP 音频走 media 适配器（mock/livekit）。

// ---- Server -> Client WS 事件 ----
export const ROOM_EVENTS = {
  MEMBER_JOINED: 'room.member_joined',
  MEMBER_LEFT: 'room.member_left',
  CAPTION: 'room.caption',
  // 玩法层
  BARRAGE: 'room.barrage', // 双语弹幕（扇给所有人，含发送者）
  QUEUE_UPDATED: 'room.queue_updated', // 上麦排队
  TELEPHONE_TURN: 'room.telephone_turn', // 传话：轮到你
  TELEPHONE_RESULT: 'room.telephone_result', // 传话：最终对比
  QUIZ_QUESTION: 'room.quiz_question', // PK 抢答：出题（按各自语言）
  QUIZ_RESULT: 'room.quiz_result', // PK 抢答：结算
  GIFT: 'room.gift', // 送礼（BIGO 式）：广播给全房 → 飘屏 + 累计魅力值
  SEATS: 'room.seats', // 麦位快照（speaker/audience 分离）：广播给全房
  MIC_REQUESTS: 'room.mic_requests', // 上麦申请列表：仅发给房主
} as const;

// ---------- 座位制（speaker/audience + 上麦审批）----------
export const NUM_SEATS = 9; // 0=房主，1..8 普通麦位
export interface SeatDto {
  index: number;
  userId: string | null;
  displayName: string | null;
  language: string | null;
  locked: boolean;
  muted: boolean;
  isHost: boolean;
}
export interface RoomSeatsPayload {
  roomId: string;
  seats: SeatDto[];
  audienceCount: number;
  hostId: string | null;
}
export interface MicRequestEntry { userId: string; displayName: string; seatIndex: number | null }
export interface RoomMicRequestsPayload { roomId: string; requests: MicRequestEntry[] }
export interface ApplyMicBody { seatIndex?: number | null }
export interface MicDecisionBody { userId: string; seatIndex?: number | null }
export interface SeatTargetBody { seatIndex: number; muted?: boolean }

export interface RoomMemberDto {
  userId: string;
  displayName: string;
  language: string; // 母语，决定该成员收到的字幕语言
}

export interface RoomDto {
  id: string;
  createdAt: string;
  members: RoomMemberDto[];
}

// ---- REST 契约 ----
export interface CreateRoomResponse {
  roomId: string;
  room: string; // media 房间名（livekit/mock）
  token: string;
}
export interface JoinRoomBody {
  language?: string; // 缺省取用户母语
}
export interface JoinRoomResponse {
  roomId: string;
  room: string;
  token: string;
  members: RoomMemberDto[];
  seats: SeatDto[];
  hostId: string | null;
}
export interface UtteranceBody {
  text: string; // MVP：一句话（真实模式由 STT 产出）
}

// ---- WS 载荷 ----
export interface RoomMemberJoinedPayload {
  roomId: string;
  member: RoomMemberDto;
}
export interface RoomMemberLeftPayload {
  roomId: string;
  userId: string;
}
/** 跨语言字幕：把发言者母语的一句话，翻成接收者母语后推给接收者。 */
export interface RoomCaptionPayload {
  roomId: string;
  fromUserId: string;
  fromName: string;
  originalText: string;
  originalLang: string;
  translatedText: string;
  targetLang: string;
  ts: number;
}

// ---------- 玩法层 ----------

// 双语弹幕：结构同字幕，但扇给所有人（含发送者），UI 作飞屏覆盖层。
export interface BarrageBody { text: string; }
export type RoomBarragePayload = RoomCaptionPayload;

// 上麦排队
export interface QueueEntry { userId: string; displayName: string; }
export interface RoomQueuePayload {
  roomId: string;
  queue: QueueEntry[];
}

// 跨语言传话小游戏（telephone）：一句话沿成员链逐跳翻译，看最终"走样"。
export interface TelephoneStartBody { text: string; }
export interface TelephonePassBody { gameId: string; text: string; }
/** 轮到某成员：把上一跳翻成他母语，请他"复述/传下去"。 */
export interface TelephoneTurnPayload {
  roomId: string;
  gameId: string;
  toUserId: string;
  fromName: string;   // 上一棒是谁
  heardText: string;  // 已翻成接收者母语
  heardLang: string;
  hop: number;        // 第几棒（1 起）
}
export interface TelephoneChainItem {
  userId: string;
  displayName: string;
  lang: string;
  text: string; // 该成员用自己母语说出的内容
}
export interface TelephoneResultPayload {
  roomId: string;
  gameId: string;
  chain: TelephoneChainItem[];
  startText: string;
  startLang: string;
  endText: string;
  endLang: string;
}

// 组队 PK 抢答（跨语言）：题目按每位成员母语下发，先答对者得分。
export interface QuizAnswerBody { questionId: string; choice: number; }
export interface QuizQuestionPayload {
  roomId: string;
  quizId: string;
  questionId: string;
  index: number;   // 第几题（0 起）
  total: number;
  prompt: string;  // 已本地化到接收者母语
  options: string[]; // 已本地化
}
export interface QuizScore { userId: string; displayName: string; score: number; }
export interface QuizResultPayload {
  roomId: string;
  quizId: string;
  scores: QuizScore[];
  winner: QuizScore | null; // 平局为 null
}

// 送礼（BIGO 式）：广播给全房（含发送者），各端播放飘屏 + 累计目标麦位魅力值。
export interface GiftBody { giftType: string; coins: number; toUserId?: string | null }
export interface RoomGiftPayload {
  roomId: string;
  fromUserId: string;
  fromName: string;
  giftType: string; // 礼物 key（前端目录映射 emoji/价格）
  coins: number; // 价值（用于魅力值累计 + 大小礼物判定）
  toUserId: string | null; // 受赠麦位（null=送给全场/房主）
  ts: number;
}
