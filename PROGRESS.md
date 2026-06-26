# LiveTranslate (LinkU) — PROGRESS（迭代日志，每轮 append）

## 2026-06-25 · LOOP-L0 一键回归闸门 — ✅ DONE
- 动作：创建 `gate.sh`（封装已绿验收）；创建 `backend/.env`（从 .env.example，全 mock）。
- 环境：Node 24 / npm 11；prisma 6（sqlite dev.db，migrate deploy 应用 20260615081845_init）。
- gate 结果：**全绿**
  - typecheck（@linku/shared + backend + app）✓
  - 验收冒烟 **27/27**：`smoke.mjs` 12 passed / 0 failed；`smoke-rt.mjs` 15 passed / 0 failed
    （AUTH/DISCOVERY/SAFETY + CALL/XLATE/PAY/GIFT/REL 全绿）
  - H5 生产构建 `expo export -p web` → `dist/` ✓
- 踩坑：
  1. `test:e2e` 无 `jest-e2e.json`/`*.e2e-spec.ts` → **不纳入 gate**；AC 验证以两个 smoke 脚本为准（与 README 一致）。
  2. seed/backend 用 ts-node 启动**不自动加载 .env** → gate 在 `backend/` 内 `set -a; . ./.env; set +a` 后再跑（prisma CLI 会自己读 .env，但 ts-node 不会）。
  3. smoke 脚本打的是**运行中的 :3000**，故 gate 必须先 seed→boot→等 "listening"→再跑冒烟→kill。
- 指标：本机全 mock，端到端零密钥可跑通。
- 遗留 / 下一步：LOOP-L1（shared 契约测试）。切真实供应商属 human checkpoint，未做。

## 2026-06-25 · gate 幂等性修复（复跑暴露的真问题）
- 现象：`gate.sh` 第二次整体复跑 RED（11/12）——`/users/me` 钱包变成 trial=0/MONTHLY。
- 根因：`seed` 用 upsert 不重置钱包；上一轮 smoke-rt 把用户订成 MONTHLY 且耗尽试用，sqlite `dev.db` 状态跨运行残留。
- 修复：gate [3] 在 migrate 前 `rm -f backend/dev.db*`（每次干净库）→ **幂等**。
- 复跑结果：**12 + 15 = 27/27 绿，exit 0**，且可重复（loop gate 的关键属性：可重复绿）。

## 2026-06-25 · LOOP-L1 shared 契约测试 — ✅ DONE
- 动作（按 SOP plan→build→gate→critique→log）：
  - 发现 `packages/shared` 是**纯 TS 类型**、无运行时 schema → mock↔real 仅靠编译期类型约束。
  - 新增 `src/contracts.ts`：zod schema 覆盖 5 个核心 WS 载荷（call_ended / translation.state / translation.paywall / gift_received / caption）+ `WS_PAYLOAD_SCHEMAS` 注册表。
    **刻意不从 index.ts 导出**，避免 zod 进入 app/expo 包、影响已绿的 H5 构建。
  - 新增 `src/contracts.test.ts`：(A) 编译期 `zod ⇔ TS 接口` 双向赋值断言（漂移即 typecheck 红）；(B) 运行期 round-trip + 非法样本拒绝。
  - runner：`node --import tsx --test`（加 zod + tsx 两个依赖到 shared）。
  - gate [4] 接入 `npm -w @linku/shared run test`。
- **CRITIQUE 验证防漂移非摆设**：给 GiftReceivedSchema 注入多余字段 → typecheck 报 TS2741/TS2345 红；还原 → 绿。
- gate 结果：**全绿**——契约 5/5 + 冒烟 27/27 + H5 构建，exit 0，幂等。
- 遗留 / 下一步：LOOP-L2（Telegram 入口脚手架，mock 归因）。切真实供应商 / 真实 Telegram 发消息 = human checkpoint。

## 2026-06-25 · LOOP-L2 Telegram 获客归因脚手架（mock）— ✅ DONE
- 设计：**单一数据源**——解析器放 `shared/src/telegram.ts`（backend 记录 + app 启动上报共用），杜绝两端漂移。
- shared：`parseTelegramInitData(initData)` 纯解析（user/startParam/authDate），导出供 app 用；+ 3 条单测（正常/坏 JSON/非数字 auth_date）。
  zod 契约仍不导出（保持 app 包干净）；本解析器无依赖，安全导出。
- backend：新增 `attribution/` 模块 —— `POST /attribution`（public，H5 启动上报）+ `GET /internal/attribution/count`（AgentTokenGuard 守卫）；prisma `Attribution` 模型 + 迁移 `20260625054343_attribution`。
- smoke.mjs +3 断言：记录 telegram 归因（source/externalId/startParam）/ internal count≥1 / 无 token 401。
- **安全红线（已遵守）**：mock 阶段**不校验 initData 的 hash**（真实校验需 bot token = human checkpoint）；全程未接真实 Telegram、未对外发消息。
- gate 结果：**全绿**——shared 8 测（5 契约 + 3 telegram）+ 冒烟 30/30（smoke 15 + smoke-rt 15）+ H5 构建，exit 0，幂等。
- 同步修正 gate.sh 文案（27→30、补 8 契约 + Telegram checkpoint）。
- 遗留 / 下一步：LOOP-L3（M3 续）= Telegram Bot/Mini App 真实入口 → **human checkpoint 必停**；或归因 bind userId（注册闭环）。

## 2026-06-25 · LOOP-L3 Telegram 真实入口（服务端校验就绪，上线待人）— ✅ 代码 done / ⏸ 上线待人
- 边界把控：在「需要真实凭据/对外」前停下。**能离线安全做的真实逻辑全部做了并证明**；真正上线（建 bot / 托管 / 真 token / 发消息）交接给人。
- BUILD：
  - `backend/src/attribution/telegram-verify.ts`：Telegram 官方 HMAC-SHA256 校验（secret=HMAC("WebAppData",token) → hash=HMAC(secret,dataCheckString)），timingSafeEqual 防时序，maxAgeSec 防重放。**服务端专用**，不进 app 包。
  - `telegram-verify.test.ts`：**用假 token 自签 initData**，5 条离线证明（合法过/篡改拒/错 token 拒/缺 hash 拒/过期拒）——零真实凭据。
  - 服务 real-mode：`ATTRIBUTION_VERIFY=mock|telegram`（默认 mock）；real 模式校验失败 400，`verified` 落库；新增 `verified` 列 + 迁移 `20260625055134_attribution_verified`。
  - env：`.env.example` 加 `ATTRIBUTION_VERIFY` + `TELEGRAM_BOT_TOKEN`（带 checkpoint 警示）。
  - gate [4] 接入 `backend test:unit`。
- gate 结果：**全绿**——13 单元（8 shared 契约 + 5 Telegram 校验）+ 30/30 冒烟 + H5 构建，exit 0，幂等。
- **交接文档** `TELEGRAM-SETUP.md`：BotFather 建 bot、托管 `app/dist`、切 `ATTRIBUTION_VERIFY=telegram` + 真 token、前端 `WebApp.initData` 上报、上线后验证。
- **红线（已守）**：未注册真实 bot、未写入真实 token、未托管对外、未发任何消息。default mock 保证本机/CI 绿。
- 下一步（仍可安全自动 loop）：归因 `userId` 回填（注册闭环）/ `start_param` 邀请裂变漏斗（mock）。真实上线 = 你按 TELEGRAM-SETUP.md 操作。

## 2026-06-25 · LOOP-L3b app 上报接线 + real-mode 冒烟（CI 证明真实链路）— ✅ DONE
- 关键认知：「真实模式」= 用 env 里的 token 做 HMAC，**用测试 token 自签即可端到端证明 HTTP 链路**，无需真实 bot。于是不等真实 token 也把代码侧全做完。
- app 端接线：`app/src/telegram/launchAttribution.ts`（globalThis 读 `Telegram.WebApp.initData`，避免依赖 DOM lib；fire-and-forget、跑一次、失败静默）+ `app/_layout.tsx` 启动调用 + `api.reportAttribution`（endpoints）。app typecheck 通过、expo web 构建仍绿。
- real-mode 冒烟：`backend/scripts/smoke-tg.mjs`（与后端同一测试 token 自签）；gate 加 `[6b]` 子运行：以 `ATTRIBUTION_VERIFY=telegram + TELEGRAM_BOT_TOKEN=测试token` 起第二个后端 → **合法 initData→201+verified=true / 篡改→400 BAD_TELEGRAM_INITDATA**，2/2 绿。
- gate 结果：**全绿**——13 单元 + 30 mock 冒烟 + **2 real-mode 冒烟** + typecheck（含 app 新代码）+ H5 构建，exit 0，幂等。
- 红线仍守：测试 token 是 gate 内的假串（`123456:GATE_TEST_TOKEN_not_real`），非真实凭据；未注册真实 bot、未托管对外、未发消息。
- 真实上线只差人：BotFather token + 托管 + 切 env（TELEGRAM-SETUP.md）。代码与 CI 已就绪。

## 2026-06-26 · 步骤2 托管：GitHub Pages 自动部署就绪 — ✅ DONE（部署待人触发）
- 回答用户「能否部署到 GitHub Pages」：可以。GH Pages 默认 HTTPS，满足 Telegram Mini App 要求。
- 处理 GH Pages 三个坑：
  - 子路径：`app/app.config.js` 按 `EXPO_PUBLIC_BASE_URL` 注入 `experiments.baseUrl`（仅 CI 设，本地/gate 无 env → 不变）。
  - `.nojekyll`：工作流生成（否则 `_expo` 被 Jekyll 忽略 → 白屏）。
  - SPA 404：工作流 `cp index.html 404.html`。
- 工作流 `.github/workflows/deploy-pages.yml`：push main / 手动 → `npm install` → `EXPO_PUBLIC_BASE_URL=/LiveTranslate npm -w app run export:web` → upload/deploy-pages。
- app 上报增强：`launchAttribution` 从 `location.hash` 的 `tgWebAppData` 兜底读 initData → 纯静态托管也能拿到，无需 telegram-web-app.js。
- **本地验证**：`EXPO_PUBLIC_BASE_URL=/LiveTranslate` 导出后 `index.html` 资源前缀 = `/LiveTranslate/_expo/...` ✓；app typecheck ✓。
- 重跑全 gate（含 app.config.js + 新上报代码）：**仍全绿**（13 单元 + 30 mock + 2 real-mode + H5 构建，exit 0）——默认无 baseUrl 构建不受影响。
- 待人：① Settings→Pages→Source=GitHub Actions；② 配 Variables（EXPO_PUBLIC_API_BASE 指向单独部署的后端、EXPO_PUBLIC_BASE_URL）；③ 后端单独托管（GH Pages 跑不了 NestJS）；④ Mini App URL 填 Pages 地址。


## 2026-06-26 · LOOP-L4 多渠道归因 + 转化漏斗 — ✅ DONE
- shared：`attribution.ts`（`parseUtmParams` / `channelFromSource` 归一化 twitter→x·fb→messenger·ig→instagram / 渠道·漏斗类型）+ 3 单测；AttributionBody/Dto 移此并增 channel/ref/campaign。
- backend：Attribution 加 channel/medium/campaign/ref；新增 `FunnelEvent` 模型 + 迁移 `20260626091936_attribution_multichannel`；端点 `POST /attribution`(多渠道)、`POST /attribution/event`(signup/activate)、`GET /internal/attribution/funnel`(渠道×阶段聚合+转化率，守卫)。
- app：`launchAttribution` 支持 Telegram initData 与 **UTM 外链**两种来源；`api.reportFunnelEvent`。
- 本地实测：twitter→channel=x（ref/campaign 落库，verified=false=外链）；funnel 按渠道出 land/signup/activate + signupRate/activateRate。
- gate：**全绿**——16 单元（11 shared + 5 Telegram 校验）+ 35 mock 冒烟（含多渠道/漏斗）+ 2 real-mode + H5 构建，exit 0。
- 配套产品分析：`docs/CHANNEL-GAMEPLAY.md`（各平台缺口 + 差异化玩法 + 合规底线 + 落地优先级）。
- 注：本地以 ts-node-dev 常驻 :3000（demo），前端 expo web :8081。多渠道改动尚未 push（main 推送仍受 workflow scope 限制）。

## 2026-06-26 · LOOP-R0 巴别塔语聊房 MVP（2 人跨语言房 + 字幕，引擎层）— ✅ DONE（UI 待下一 loop）
- 设计：顺现有架构——房间复用 MEDIA 适配器(token，mock/livekit 可切)+ TRANSLATION_ENGINE(译)+ RealtimeEmitter(按 userId WS 扇出)。
- 给 `TranslationEngine` 加 `translate(text,from,to)`（三明治的 MT 段）：mock 用平行短语库跨语映射、命中即真译否则回退占位；gemini passthrough 桩（真实由 agent 产）。
- shared：`room.ts`（RoomDto/成员/字幕载荷 + ROOM_EVENTS）。
- backend `rooms/` 模块（in-memory，无 DB）：`POST /rooms`、`/:id/join`(带 language)、`/:id/utterance`、`/:id/leave`、`GET /:id`。发言扇出：把发言者母语句子翻成每个其他成员母语 → 仅推给他人。
- 冒烟 `smoke-room.mjs`（2 WS 客户端）：建房→A/B 加入(zh/es)→成员加入事件→A 说中文 B 收西语字幕(`你好，很高兴认识你！`→`¡Hola, mucho gusto!`，命中平行库)→B 说西语 A 收中文字幕→发言者不收自己字幕。**7/7**。
- gate：**全绿**——16 单元 + 42 mock 冒烟（含语聊房 7）+ 2 real-mode + typecheck + H5 构建，exit 0。
- 本地实测：`POST /rooms` 返回 roomId+token。
- 待下一 loop：app 房间 UI（房间页 + 实时字幕流渲染 + 发言/上麦）；真实音频接 livekit + STT/TTS（human checkpoint）。

## 2026-06-26 · LOOP-R1 巴别塔语聊房 app UI — ✅ DONE
- app 房间页 `app/babel.tsx`：选语言 → 新建/输入房间号进房 → 实时字幕流（每条显示 译文大字 + 原文小字 + 发言者/语向）→ 快捷短语 + 自由文本发言；离开。
- WS：复用共享 socket，房内订阅 ROOM_EVENTS（caption/member_joined/member_left）；进房兜底 connectWs。
- API：endpoints 加 createRoom/joinRoom/roomUtterance/leaveRoom。
- 入口：首页筛选行加「🗣 语聊房」→ /babel。
- 验证：app + shared typecheck 通过；`expo export -p web` 构建成功（含房间页，816 模块）；web dev :8081 重启、backend :3000 在跑。
- 体验：两窗口分别选 zh/es 进同一房间号 → 快捷短语命中平行库 → 对方看到自己母语字幕。
- 待下一 loop：真实音频（MEDIA=livekit + STT/TTS，human checkpoint）；房间列表/上麦/弹幕等玩法层。

## 2026-06-26 · LOOP-R2 真实音频（LiveKit token 签发，服务端就绪）— ✅ 代码 done / ⏸ 上线待人
- 顺架构边界：后端只签发 LiveKit token；真实 STT/MT/TTS 走 agent/（Gemini Live，见 agent/README.md）。
- BUILD：装 livekit-server-sdk；实现 `LiveKitMediaTransport`（AccessToken：roomJoin+canPublish/Subscribe，HS256 签名；createRoom 离线返回房名，加入时自动建房）。
- 离线单测 `livekit-token.test.ts`（假 key 自签自验，无需真实服务）：合法 token 可验(sub/identity、video.room/roomJoin)、错密钥失败、缺凭据报错。3/3。
- gate `test:unit` 扩到 src/adapters/media/*.test.ts。
- gate：**全绿**——19 单元（11 shared + 8 backend：5 Telegram + 3 LiveKit）+ 42 mock 冒烟 + 2 real-mode + H5 构建，exit 0。
- 交接 `LIVEKIT-SETUP.md`：LiveKit 凭据 → MEDIA_PROVIDER=livekit → 客户端 livekit-client 拾音入房 → （可选）跑 agent 做真实翻译。
- 红线：未联真实 LiveKit、未跑 agent、未写真实密钥；默认 mock 保 CI 绿。客户端拾音联调需真实服务，留待凭据就绪（我可在你切好 env 后接客户端那段）。

## 2026-06-26 · LOOP-R3 玩法层：双语弹幕 / 上麦排队 / 跨语言传话 — ✅ DONE
- 引擎（rooms.service）：barrage(扇全房含发送者，逐人译)；raise/lowerHand + FIFO 队列广播；telephone(按 join 顺序成链，逐跳翻译派发 turn，末跳广播 result 对比起止)。
- shared：ROOM_EVENTS 增 barrage/queue_updated/telephone_turn/telephone_result + 载荷/Body 契约。
- 端点：/rooms/:id/barrage、/raise-hand、/lower-hand、/telephone/start、/telephone/pass。
- app 房间页：弹幕条 + 「弹幕」发送键；「✋上麦/下麦」+ 成员麦序角标；「🎙开一局传话」+ 轮次卡(听到→复述传下去)+ 结果卡(链路起→终)。
- 冒烟 smoke-room 扩到 14（7 基础 + 7 玩法：弹幕2/排队3/传话2）。
- gate：**全绿**——19 单元 + 49 mock 冒烟 + 2 real-mode + typecheck + H5 构建，exit 0。
- 全程 mock，无新外部依赖/凭据。

## 2026-06-26 · LOOP-R4 真实音频客户端接线（LiveKit）— ✅ 代码 done / ⏸ 出声待凭据
- 装 livekit-client；`app/src/realtime/livekitAudio.ts`：懒加载、仅 Web、仅 `EXPO_PUBLIC_TRANSPORT=livekit`+`EXPO_PUBLIC_LIVEKIT_URL` 时连接（connect+setMicrophoneEnabled+订阅播放），默认 mock no-op。
- 房间页进房自动接入、离开/卸载断开；顶部状态行显示音频模式。
- tsconfig 加 module=esnext/moduleResolution=bundler（仅修 tsc，让动态 import 通过；Metro 不受影响）。
- 验证：app typecheck ✅ + H5 export ✅（含 livekit-client）。真实出声需你的 LiveKit URL + 后端 MEDIA_PROVIDER=livekit（LIVEKIT-SETUP.md §3 已标“代码已接”）。

## 2026-06-26 · LOOP-R5 组队 PK 抢答（跨语言）— ✅ DONE
- 引擎：题目按各成员母语本地化下发（quiz-bank 多语言题库）；抢答先答对者 +10、推进；末题结算 winner/scores。端点 /rooms/:id/quiz/{start,answer}。
- shared：QUIZ_QUESTION/QUIZ_RESULT 事件 + 载荷/Body。
- app 房间页：「🏆 PK 抢答」开局；题目卡（本地化题干+选项可点）；结果卡（🥇winner+分数）。
- 冒烟 smoke-room 扩到 17（+3 PK：A 看中文题/B 看西语题同题本地化、抢答推进、A 胜 20 分）。
- gate：**全绿**——19 单元 + 52 mock 冒烟 + 2 real-mode + typecheck + H5 构建，exit 0。
- 待下一 loop：家族/成长体系（积分等级、跨国 CP 亲密度、家族战）。

## 2026-06-26 · LOOP-R6 成长体系（积分/等级 + CP 亲密度 + 家族战）— ✅ DONE
- 持久化（prisma 迁移 20260626121256_growth）：GrowthProfile / Bond(双人归一化) / Family / FamilyMember。
- shared：levelFromXp/xpToNextLevel 纯函数（+2 单测）+ 契约。
- backend growth 模块：/growth/me、/growth/award、/growth/bond(+GET)、/families(create/join/contribute)、/families/leaderboard。
- app：/growth 页（个人 Lv/XP + 做任务、CP 亲密度、家族创建/贡献/排行榜）；首页加「🏆 成长」入口。
- 冒烟 smoke-growth 7：+120→Lv2/leveledUp、/me toNext=80、CP 累加 50 双向一致、家族创建自动入会、排行 Dragons 居首、非成员贡献 400。
- gate：**全绿**——21 单元（13 shared + 8 backend）+ 59 mock 冒烟 + 2 real-mode + typecheck + H5 构建，exit 0。
