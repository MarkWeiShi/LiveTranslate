# LinkU MVP · 工程级 PRD / AI Build Spec（赛道一：跨境 1v1 实时翻译异性深度社交）

> 版本：v1.0 ｜ 日期：2026-06-15
> 用途：**本文件可直接交给 AI 编码代理（如 Claude Code）分阶段生成可运行的 MVP**。
> 原则：范围收敛、技术选型确定、数据/接口/屏幕/验收标准齐全、第三方依赖均提供 Mock，使 AI 无需真实 HelloTalk/支付凭证即可先跑通闭环。
> 关联：`PRD_赛道一_跨境1v1异性深度社交.md`（完整产品 PRD）、`跨境社交产品调研_Gemini-LiveTranslate.md`

---

## 0. 给 AI Builder 的说明（先读）

- **目标**：构建一个跨平台移动 App + 后端，验证「HelloTalk 登录 → 发现异国异性 → 发起 1v1 实时翻译视频 → 试用额度用尽进付费墙 → 安全闭环」的核心链路。
- **构建顺序**：严格按 §12 Build Plan 的里程碑 M1→M7 逐步实现，每个里程碑结束后必须满足对应 §8 验收标准（AC）。
- **第三方依赖**：HelloTalk SSO、支付、Gemini、LiveKit 均有 §3/§10 的 Mock/Adapter 约定。**开发期默认用 Mock，通过环境变量切换真实实现**，不要把任何密钥写进代码。
- **不要扩大范围**：§1 标注 OUT 的一律不做。

---

## 1. MVP 范围（In / Out）

### 1.1 IN（必须实现）
| 模块 | 功能 |
|---|---|
| 账号 | HelloTalk OAuth 登录（带 Mock Provider）+ 画像导入 |
| 引导 | 意图声明、语言确认、相机/麦克风授权 |
| 发现 | 在线异国异性列表（按语言/在线/性别筛选）、用户详情 |
| 通话 | 1v1 视频/语音 + **双向实时语音翻译（Gemini 3.5 Live Translate）** + 双语字幕 + 降级 |
| 变现 | 试用翻译额度（服务端计时）→ 付费墙 → 订阅/钻石（Mock IAP）+ 通话内送礼 |
| 安全 | 举报、拉黑、通话内一键退出、字幕敏感词/诱导话术检测、风险事件记录 |
| 沉淀 | 好友、通话历史 |

### 1.2 OUT（本期明确不做）
多人/直播、女性提现结算、复杂公会、美颜/虚拟背景、A/B 实验平台、Web 端、推荐算法（用简单规则排序）、关系订阅（情侣包）。

---

## 2. 技术栈与架构

### 2.1 技术栈（已选定，AI 直接采用）
| 层 | 选型 | 备注 |
|---|---|---|
| 移动端 | **React Native + Expo（TypeScript）** | 跨 iOS/Android，AI 友好 |
| 状态管理 | Zustand + React Query | — |
| 后端 | **Node.js + NestJS（TypeScript）** | REST + WebSocket(网关) |
| 数据库 | **PostgreSQL** + Prisma ORM | — |
| 缓存/在线态 | **Redis** | presence、试用计时、限流 |
| 实时音视频 | **LiveKit**（自托管或 LiveKit Cloud） | RN SDK 完善；备选 Agora |
| 实时翻译 | **Gemini 3.5 Live Translate**（Gemini Live API，WS 流式） | 由 LiveKit Agent 桥接 |
| 翻译工作进程 | **LiveKit Agents（Python）** | 每房一个 Agent，桥接 Gemini，发布翻译音轨+字幕 |
| 鉴权 | OAuth2/OIDC（HelloTalk）+ 自签 JWT | — |
| 支付 | RevenueCat 封装 IAP（带 Mock） | MVP 用 Mock 收据校验 |

### 2.2 系统架构图
```
┌──────────────┐        REST/JWT         ┌─────────────────────┐
│  RN App (A)   │◀──────────────────────▶│   NestJS Backend     │
│  RN App (B)   │     WS 信令/事件        │  Auth/Profile/Call   │
└──────┬───────┘◀──────────────────────▶│  Wallet/Safety       │
      │  WebRTC 媒体                     └─────────┬───────────┘
      │                                            │ 签发 LiveKit Token / 起停 Agent
      ▼                                            ▼
┌─────────────────────────────────────────────────────────────┐
│                        LiveKit Room (callId)                  │
│  participant A audio/video  ──┐                               │
│  participant B audio/video  ──┤                               │
│  ┌───────────────────────────▼────────────────────────────┐  │
│  │  Translation Agent (Python, 隐藏参与者)                  │  │
│  │  订阅 A 音频 → Gemini Live(→B母语) → 发布"译音轨@B"      │  │
│  │  订阅 B 音频 → Gemini Live(→A母语) → 发布"译音轨@A"      │  │
│  │  字幕(原文+译文) → Room DataChannel → A/B                │  │
│  │  计时 translatedSec、试用耗尽→发 translation.paywall 事件 │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 实时翻译通话管线（关键，务必照此实现）
1. 主叫 `POST /calls` → 后端建 `CallSession(status=ringing)`，向被叫推 `incoming_call` 事件，给主叫返回 LiveKit token。
2. 被叫 `POST /calls/:id/accept` → 后端置 `active`，签发被叫 token，并**起一个 Translation Agent 加入该 room**。
3. Agent 对每个方向开一条 Gemini Live Translate 会话：源说话人音频流入，按对端母语产出**翻译音频**（保留音色）+ **字幕文本**。
4. Agent 把"译音轨@对端"发布到 room；对端客户端**订阅译音轨、对原始说话人音轨做 ducking（压低/静音）**，播放译音；字幕经 DataChannel 渲染（原文+译文，可开关）。
5. Agent 持续累计 `translatedSec`；当**试用耗尽且未订阅** → 停止翻译、发 `translation.paywall`；原始音轨恢复正常音量，通话不中断（仅失去翻译）。
6. 任一端 `POST /calls/:id/end` 或断线 → Agent 退出、释放 Gemini 会话、落库时长与用量。

> **降级**：Agent 检测 Gemini 延迟 P95 超阈或识别失败 → 停发译音轨，仅发字幕，并发 `translation.degraded` 事件，客户端提示「已切换为字幕翻译」。

---

## 3. HelloTalk 集成契约（含 Mock）

> HelloTalk 接口为合伙人内部对接，开发期用 **Mock Provider** 跑通，上线切真实。

### 3.1 登录（OAuth2 Authorization Code / OIDC）
- 配置：`HELLOTALK_ISSUER` / `CLIENT_ID` / `CLIENT_SECRET` / `REDIRECT_URI`。
- 流程：App 打开 HelloTalk 授权页 → 回调带 `code` → `POST /auth/hellotalk/callback {code}` → 后端换 token、拉 UserInfo、**首次登录创建本地 User 并导入画像** → 返回本地 JWT。
- **Mock**：当 `AUTH_PROVIDER=mock` 时，`POST /auth/hellotalk/callback` 接受 `{mockUserId}`，从 §11 种子用户直接签发 JWT。

### 3.2 HelloTalk 画像导入字段映射（UserInfo → 本地 User）
| HelloTalk 字段 | 本地字段 | 用途 |
|---|---|---|
| `sub` | `helloTalkUserId` | 唯一标识、防重 |
| `name`/`nickname` | `displayName` | 展示 |
| `picture` | `avatarUrl` | 展示 |
| `native_language` | `nativeLanguage`(ISO 639-1) | **翻译目标语**、匹配 |
| `learning_languages[]` | `learningLanguages[]` | 匹配 |
| `language_level` | `languageLevel`(A1–C2) | 匹配权重 |
| `gender` | `gender` | 异性发现/合规 |
| `region`/`timezone` | `region`/`timezone` | 时区重叠匹配 |
| `interests[]` | `interests[]` | 排序 |
| `real_person_verified` | `realPersonVerified` | **反诈核心徽章** |
| `trust_score` | `trustScore`(0–100) | 风控、排序、女性反向筛选 |

### 3.3 复用的 HelloTalk 能力（MVP 体现）
- **实人认证继承**：直接信任 HelloTalk `real_person_verified`，发现页/详情页展示徽章（MVP 不自建活体）。
- **信任分**：作为发现排序与风控阈值输入。
- **翻译/转写理念复用**：通话字幕沿用 HelloTalk「原文+译文」双行展示范式；术语库可后续接入。
- **跨产品黑名单**：拉黑/举报写入共享风控（MVP 落本地表，预留同步接口 `RISK_SYNC_WEBHOOK`）。

---

## 4. 数据模型（Prisma 概要）

```prisma
model User {
  id                String   @id @default(cuid())
  helloTalkUserId   String   @unique
  displayName       String
  avatarUrl         String?
  nativeLanguage    String              // 翻译目标语
  learningLanguages String[]
  languageLevel     String?             // A1..C2
  gender            Gender
  region            String?
  timezone          String?
  bio               String?
  interests         String[]
  realPersonVerified Boolean  @default(false)
  trustScore        Int      @default(50)
  intent            Intent   @default(SOCIAL)   // SOCIAL/DEEP/LANG_SOCIAL
  createdAt         DateTime @default(now())
  wallet            Wallet?
}

model Wallet {
  userId             String  @id
  user               User    @relation(fields:[userId], references:[id])
  diamonds           Int     @default(0)
  trialSecondsLeft   Int     @default(420)       // 7 分钟试用翻译额度
  subscriptionTier   SubTier @default(NONE)      // NONE/WEEKLY/MONTHLY
  subscriptionExpiry DateTime?
}

model CallSession {
  id               String     @id @default(cuid())
  callerId         String
  calleeId         String
  mode             CallMode   // VIDEO/VOICE
  status           CallStatus // RINGING/ACTIVE/ENDED/DECLINED/MISSED
  translationOn    Boolean    @default(true)
  startedAt        DateTime?
  endedAt          DateTime?
  durationSec      Int        @default(0)
  translatedSec    Int        @default(0)
  createdAt        DateTime   @default(now())
}

model Gift     { id String @id @default(cuid()) callId String fromId String toId String giftType String diamonds Int createdAt DateTime @default(now()) }
model Friendship { id String @id @default(cuid()) userIdA String userIdB String status FriendStatus createdAt DateTime @default(now()) }
model Block    { id String @id @default(cuid()) userId String blockedUserId String createdAt DateTime @default(now()) @@unique([userId, blockedUserId]) }
model Report   { id String @id @default(cuid()) reporterId String targetId String callId String? reason String detail String? createdAt DateTime @default(now()) }
model RiskEvent{ id String @id @default(cuid()) userId String callId String? type String score Int snippet String? createdAt DateTime @default(now()) }

enum Gender { MALE FEMALE OTHER }
enum Intent { SOCIAL DEEP LANG_SOCIAL }
enum SubTier { NONE WEEKLY MONTHLY }
enum CallMode { VIDEO VOICE }
enum CallStatus { RINGING ACTIVE ENDED DECLINED MISSED }
enum FriendStatus { PENDING ACCEPTED }
```
> 在线态 `Presence` 存 Redis：`presence:{userId} = {online, availableForCall, lastSeen}`，TTL 心跳续期。

---

## 5. API 与实时事件规格

### 5.1 REST（JWT Bearer，除登录外均鉴权）
| Method & Path | 说明 | 关键响应 |
|---|---|---|
| `POST /auth/hellotalk/callback` | 登录换 JWT（支持 mock） | `{token, user, isNewUser}` |
| `GET /users/me` | 自己资料+钱包 | `User & Wallet` |
| `PATCH /users/me` | 改意图/简介/翻译语种 | `User` |
| `GET /discovery?lang&gender&onlineOnly&page` | 发现列表（排序：在线>实人认证>信任分>时区重叠） | `UserCard[]` |
| `GET /users/:id` | 用户详情 | `UserCard` |
| `POST /presence/heartbeat` | 上报在线/可通话 | `204` |
| `POST /calls` `{calleeId, mode}` | 发起呼叫（校验拉黑/在线/可通话） | `{callId, livekitToken, room}` |
| `POST /calls/:id/accept` | 接听（起 Agent） | `{livekitToken, room}` |
| `POST /calls/:id/decline` | 拒接 | `204` |
| `POST /calls/:id/end` `{reason}` | 挂断 | `{durationSec, translatedSec}` |
| `POST /calls/:id/translation/toggle` `{on}` | 通话内开关翻译 | `204` |
| `GET /calls/history` | 通话记录 | `CallSession[]` |
| `GET /wallet` | 钱包/订阅/试用余额 | `Wallet` |
| `POST /iap/verify` `{receipt}` | 充值/订阅（mock 直接发放） | `Wallet` |
| `POST /calls/:id/gift` `{giftType}` | 通话内送礼（扣钻石） | `{wallet, gift}` |
| `POST /reports` `{targetId, callId?, reason, detail?}` | 举报 | `201` |
| `POST /blocks` `{blockedUserId}` / `GET /blocks` / `DELETE /blocks/:id` | 拉黑管理 | — |

### 5.2 实时事件（后端 WS `/ws` + LiveKit DataChannel）
| 事件 | 通道 | 载荷 | 客户端反应 |
|---|---|---|---|
| `incoming_call` | WS | `{callId, caller:UserCard, mode}` | 弹来电屏 |
| `call_accepted` / `call_declined` / `call_ended` | WS | `{callId, ...}` | 进通话/收尾 |
| `caption` | DataChannel | `{speakerId, originalText, translatedText, ts}` | 渲染双语字幕 |
| `translation.state` | DataChannel | `{state: active\|paused\|degraded\|paywall, translatedSecLeft}` | 状态条/降级提示 |
| `translation.paywall` | DataChannel | `{reason:'trial_exhausted'}` | 弹付费墙、原音恢复 |
| `gift_received` | DataChannel | `{fromId, giftType}` | 礼物动画 |
| `risk_warning` | DataChannel | `{level, message}` | 反诈提示条 |

---

## 6. 屏幕规格（React Native，逐屏可实现）

> 每屏给出：组件、状态、主要交互、导航、空/错/加载态。

1. **Auth/Splash** — 「用 HelloTalk 登录」按钮 → OAuth/Mock → 成功则进引导或主页。错误 toast。
2. **Onboarding（仅新用户）** — 三步：①意图（交友/深聊/语言+社交）②确认翻译目标语（默认母语）③请求相机+麦克风权限。完成写 `PATCH /users/me`。
3. **Home/Discovery（主 Tab）** — 顶部筛选（语言、性别、仅在线）；卡片列表（头像、昵称、国旗+母语、实人/信任徽章、在线点、"视频/语音"按钮）。下拉刷新、分页、空态、骨架屏。点卡进详情。
4. **User Detail** — 大图、徽章、简介、兴趣、语言对（"TA 说 X，你听到中文"提示）、`视频通话`/`语音通话`/`举报`/`拉黑`。被拉黑/离线时按钮置灰。
5. **Incoming Call** — 来电者信息、接听/拒接、模式标识。30s 未接 → `MISSED`。
6. **In-Call（核心屏）** — 远端视频全屏 + 本地小窗；底部控制：麦克风、摄像头翻转、**翻译开关（默认开）**、送礼、挂断、举报入口；**字幕区**（双语，可隐藏）；顶部状态条：`翻译中 · 剩余试用 6:30` / `字幕模式（已降级）` / `翻译已暂停`；`translation.paywall` 时弹付费 Sheet。语音模式无视频画面，显示头像+声纹动效。
7. **Paywall Sheet** — 触发点：试用耗尽 / 主动点翻译开关且无额度。内容：周/月订阅（解锁无限翻译时长）、钻石充值；`POST /iap/verify`（mock 即时到账）后恢复翻译。
8. **Wallet/Subscription** — 钻石余额、试用余额、当前订阅与到期、充值/订阅入口。
9. **My Profile** — 自己资料、意图、翻译语种、退出登录。
10. **Call History** — 列表（对端、时长、翻译时长、模式、时间），点击可再次发起。
11. **Friends** — 好友列表，进详情发起通话。
12. **Report/Block** — 举报原因选择+详情提交；拉黑确认。

---

## 7. 核心状态机

### 7.1 通话状态机
```
[idle] --POST /calls--> [ringing(caller)]
[ringing(callee)] --accept--> [active]   --end/disconnect--> [ended]
[ringing(callee)] --decline--> [declined]
[ringing] --30s timeout--> [missed]
[active] --translation.paywall--> [active(无翻译)]  (通话不断)
```

### 7.2 翻译会话状态机（Agent 内）
```
[init] -> [active] --试用耗尽&未订阅--> [paywalled(停翻译,原音恢复)]
              |--延迟超阈/失败--> [degraded(仅字幕)]
              |--toggle off--> [paused]
[* ] --call ended--> [closed(释放Gemini, 落库 translatedSec)]
```

### 7.3 试用/计费规则（服务端强制，防白嫖）
- 新用户 `trialSecondsLeft=420`（7 分钟翻译）。
- 仅在 `translation.state=active` 时按秒扣减（由 Agent 上报 `translatedSec`，后端是唯一记账方）。
- `trialSecondsLeft<=0` 且 `subscriptionTier=NONE` → 触发 `translation.paywall`。
- 订阅有效（`subscriptionExpiry>now`）→ 不扣试用、无限翻译时长。
- **成本护栏**：单用户并发翻译通话上限 1；单通话最长 60 分钟自动收尾；后端拒绝为余额不足且未订阅的用户启动 Agent。

---

## 8. 功能验收标准（Given/When/Then）

**AC-AUTH-1** Given mock 模式，When 用 `seed_male_01` 登录，Then 返回有效 JWT 且本地 User 含导入的母语/性别/实人徽章。
**AC-AUTH-2** Given 同一 HelloTalk 用户二次登录，Then 不重复建号（`helloTalkUserId` 唯一）。
**AC-DISC-1** Given 我是中文男性，When 打开发现页筛选"女性/仅在线"，Then 列表只含在线女性，排序为 在线>实人认证>信任分>时区重叠，且不含已拉黑用户。
**AC-CALL-1** Given 对方在线可通话，When 我发起视频呼叫，Then 对方收到 `incoming_call`，接听后双方进入同一 LiveKit room 并看到彼此视频。
**AC-XLATE-1** Given 通话激活且翻译开，When 对方用其母语说话，Then 我在 ≤5s（P95）内听到我的母语译音（原音被 ducking）并看到双语字幕。
**AC-XLATE-2** Given Gemini 高延迟/失败，Then 自动切字幕模式并提示「已切换为字幕翻译」，通话不中断。
**AC-PAY-1** Given 新用户试用 420s，When 翻译累计满 420s 且未订阅，Then 触发付费墙、停止译音、原音恢复、通话继续。
**AC-PAY-2** Given 付费墙，When mock 订阅月套餐成功，Then 翻译恢复 active 且不再扣试用。
**AC-PAY-3** （成本护栏）Given 用户已有一通翻译中通话，When 再发起第二通，Then 后端拒绝并提示。
**AC-SAFE-1** Given 通话中字幕命中诱导话术（如索要外部联系方式/转账/加密投资），Then 触发 `risk_warning` 提示条并写入 `RiskEvent`。
**AC-SAFE-2** When 我举报并拉黑对方，Then 对方从我的发现/来电中消失，且双方无法再次呼叫，`Report`/`Block` 落库。
**AC-REL-1** When 通话结束，Then 生成 `CallSession` 历史含 `durationSec` 与 `translatedSec`，双方可在记录页看到。

---

## 9. 非功能性需求
- **翻译延迟**：P50 ≤ 3s，P95 ≤ 5s；超阈降级。
- **音视频**：720p/15–30fps 自适应；弱网降级到语音。
- **安全**：JWT 短时 + 刷新；LiveKit token 单房单次；所有写接口校验拉黑关系；敏感词/语义检测作用于**翻译后文本**。
- **成本**：见 §7.3 护栏；翻译仅在 `active` 计费；字幕模式不调用译音以省成本。
- **隐私合规**：画像导入需用户授权；通话默认不录制；字幕仅本地渲染不持久化原文（除风控命中片段）。
- **可观测**：记录每通话 translatedSec、延迟分布、降级率、付费墙触达、风控命中。

---

## 10. 环境变量 / 第三方账号（.env）
```
# Auth
AUTH_PROVIDER=mock            # mock | hellotalk
HELLOTALK_ISSUER=
HELLOTALK_CLIENT_ID=
HELLOTALK_CLIENT_SECRET=
HELLOTALK_REDIRECT_URI=
JWT_SECRET=

# Realtime
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=

# Translation
GEMINI_API_KEY=
GEMINI_LIVE_MODEL=gemini-3.5-live-translate-preview

# Payments
PAYMENT_PROVIDER=mock         # mock | revenuecat
REVENUECAT_API_KEY=

# Infra
DATABASE_URL=postgres://...
REDIS_URL=redis://...
RISK_SYNC_WEBHOOK=            # 可空：与 HelloTalk 共享黑名单
```

---

## 11. 种子 / Mock 数据（开发自测）
- `seed_male_01`：中文母语、男、实人认证、trustScore 80、`trialSecondsLeft=420`、在线可通话。
- `seed_female_01`：西语母语、女、实人认证、trustScore 85、在线可通话。
- `seed_female_02`：英语母语、女、实人认证、trustScore 60、在线。
- `seed_female_03`：阿语母语、女、未认证、trustScore 40、离线（用于测试不可呼叫/排序靠后）。
- Mock Gemini Agent：可注入"伪翻译"（把文本前缀 `[zh]`/`[es]`）与可控延迟/失败，便于测 §8 的翻译/降级 AC，无需真实 Key。
- Mock IAP：`POST /iap/verify {receipt:'mock_month'}` 直接发放月订阅。

---

## 12. Build Plan（AI 分阶段构建里程碑）
| 里程碑 | 交付 | 通过标准 |
|---|---|---|
| **M1 脚手架+鉴权+资料** | RN+NestJS+Prisma+Redis 工程；Mock 登录；`/users/me`；引导页 | AC-AUTH-1/2 |
| **M2 发现+在线态** | 发现页、筛选、详情、presence 心跳 | AC-DISC-1 |
| **M3 通话信令+视频（无翻译）** | `/calls/*`、来电/接听、LiveKit 视频接通 | AC-CALL-1 |
| **M4 实时翻译** | LiveKit Agent 桥接 Gemini（先用 Mock Agent）、译音轨、双语字幕、开关、降级 | AC-XLATE-1/2 |
| **M5 付费墙+钱包** | 试用计时（服务端）、付费墙、Mock 订阅/钻石、送礼、成本护栏 | AC-PAY-1/2/3 |
| **M6 安全** | 举报/拉黑、字幕诱导话术检测、RiskEvent、风险提示条 | AC-SAFE-1/2 |
| **M7 沉淀+收尾** | 好友、通话历史、空/错/加载态打磨 | AC-REL-1 |

> 每个里程碑：先后端接口+Mock，再接 RN 屏幕，最后跑该里程碑 AC。完成 M1–M4 即可演示「跨语种实时翻译视频」核心 Demo；M5–M7 补齐商业化与安全闭环。

---

## 附录 A：Gemini Live Translate 桥接要点（LiveKit Agent / Python 伪代码）
```python
# 每个 room 一个 agent；每个发言方向一条 Gemini Live 会话
async def on_track_subscribed(track, participant):
    target_lang = listener_native_lang(participant)        # 对端母语
    gem = await gemini_live.connect(model=GEMINI_LIVE_MODEL,
                                    config={"mode": "translate", "target": target_lang})
    async for frame in audio_frames(track):                # 源说话人 PCM
        await gem.send_audio(frame)
        async for out in gem.receive():                    # 流式产出
            if out.audio:  publish_translated_audio(out.audio, to=participant_opposite)
            if out.text:   room.data.send(caption_payload(out))   # 原文+译文字幕
            report_translated_seconds(call_id, out.duration)      # 服务端记账→试用扣减
            if latency_p95() > THRESHOLD or out.error:
                set_state("degraded"); stop_publishing_audio()    # 仅字幕
```

## 附录 B：第三方替换点（Adapter 接口，便于先 Mock 后真接）
- `AuthProvider`：`exchangeCode(code) -> HelloTalkProfile`（mock / hellotalk）。
- `TranslationEngine`：`startSession(srcAudio, targetLang) -> {audio, captions, seconds}`（mockGemini / gemini）。
- `PaymentProvider`：`verify(receipt) -> WalletGrant`（mock / revenuecat）。
- `MediaTransport`：`createRoom(callId)` / `mintToken(user, room)`（livekit / agora）。
> 所有外部依赖经 Adapter 注入，环境变量切换实现，保证 MVP 可在无真实凭证下端到端运行。
