# LiveTranslate (LinkU) — GOALS

> 目标树见 ../LOOP-ENGINEERING.md §3。L2「Loop 目标」才进 loop；每个带 DoD + verify。

## L0 北极星
两个母语不同的异国用户，30 秒内 1v1 实时翻译视频聊起来；试用耗尽进付费墙；诈骗/举报安全闭环可靠。
**获客侧**：从 Telegram 社区低成本导入用户并完成首通。
核心指标：首通完成率 · 付费转化 · Telegram→注册 CAC。

## L1 里程碑
1. **M1 巩固已绿骨架**：`gate.sh` 一键回归（typecheck + 27 冒烟 + H5 构建）。✅ 已达成（见 PROGRESS）。
2. **M2 真实链路灰度**（env 切换，**human checkpoint**）：translation=gemini / media=livekit / auth=hellotalk 逐个从 mock 切真，每切一个加一条契约测试。
3. **M3 Telegram 获客闭环**（PRD→代码）：Telegram Mini App/Bot 入口 → 落地 H5（expo web）→ 注册归因埋点 → 首通漏斗。先做赛道一 1v1。

## L2 Loop 目标

### LOOP-L0: 一键回归闸门（封装已绿验收） — status: **done ✅**
- Why: M1；没有绿灯就没有自动迭代地基。
- Scope: 新增 gate.sh（复用 backend/scripts/smoke*.mjs + typecheck + export:web）；不改业务。
- DoD:
  - [x] ./gate.sh 全绿（全 mock、零密钥）
  - [x] typecheck（shared+backend+app）通过
  - [x] 27/27 验收冒烟绿（smoke.mjs 12 + smoke-rt.mjs 15）
  - [x] H5 expo web 生产构建成功（dist/）
- Verify: `cd ParaEngine/LiveTranslate && ./gate.sh`
- Budget: 4 轮；Human checkpoint: 无

### LOOP-L1: shared 契约测试（防 mock↔real 漂移） — status: **done ✅**
- Why: M2 前置；切真实供应商时不破协议。
- Scope: packages/shared 加 zod/类型契约测试 + 纳入 gate（typecheck 已覆盖类型，补运行时 schema 断言）。
- DoD:
  - [x] 对核心事件/DTO（call_ended/translation.state/paywall/gift/caption）各 1 条 schema round-trip 断言（5/5 绿）
  - [x] 编译期 zod⇔TS 接口双向赋值防漂移（已用注入漂移→typecheck 变红→还原 验证有效）
  - [x] 纳入 gate（`npm -w @linku/shared run test`，在 typecheck 之后）
  - [x] ./gate.sh 仍全绿（27 冒烟 + 5 契约 + H5 构建）
- 实现：`src/contracts.ts`（zod，**不从 index.ts 导出**以免污染 app/expo 包）+ `src/contracts.test.ts`（node:test + tsx）。
- Verify: `./gate.sh`
- Budget: 5 轮（用 1 轮）；Human checkpoint: 无

### LOOP-L2: Telegram 入口脚手架（mock 归因） — status: **done ✅**
- Why: M3 第一步；先把入口+埋点漏斗用 mock 打通，不接真实 Bot。
- Scope: shared 加 Telegram initData 解析（单一数据源）；backend 加 Attribution 模型 + `POST /attribution`（public）+ `GET /internal/attribution/count`（agent-token 守卫）。
- DoD:
  - [x] 携带 tgWebAppData 启动 → 归因被记录（冒烟：source=telegram / externalId / startParam=ref_smoke）
  - [x] internal count 反映已记录（count≥1）且无 token 返回 401（守卫生效）
  - [x] shared `parseTelegramInitData` 单测 3 条（正常/坏输入/非数字 auth_date）纳入 gate
  - [x] ./gate.sh 全绿（8 契约 + 30/30 冒烟 + H5 构建）
- 实现：`shared/src/telegram.ts`（纯解析，**hash 不校验**——真实校验需 bot token = human checkpoint）+ backend `attribution/` 模块 + prisma `Attribution` 模型（迁移 20260625054343_attribution）。
- Verify: `./gate.sh`
- Budget: 6 轮（用 1 轮）；**Human checkpoint: 接真实 Telegram Bot / 对外发消息 / initData hash 校验 前必停。**

### LOOP-L3: Telegram 真实入口（服务端校验就绪，上线待人）— status: **code done ✅ / go-live blocked-on-human ⏸**
- Why: M3 真实化第一步；让 `/attribution` 在真实模式可信。
- Scope: backend HMAC 校验器 + env 开关 + `verified` 字段；**不含**注册真实 bot / 托管 / 发消息。
- DoD:
  - [x] `verifyTelegramInitData`（Telegram 官方 HMAC-SHA256 + timingSafeEqual + maxAge 防重放）
  - [x] 离线单测 5 条（合法/篡改/错 token/缺 hash/过期）——用假 token 自签证明，无需真实凭据
  - [x] 服务 real-mode（`ATTRIBUTION_VERIFY=telegram` 校验失败 400；`verified` 落库）
  - [x] `verified` 列 + 迁移；env 文档（.env.example）
  - [x] 纳入 gate（`backend test:unit`），./gate.sh 仍全绿
  - [x] app 端 `WebApp.initData` 启动上报接线（`app/src/telegram/launchAttribution.ts` + `_layout` 调用 + `api.reportAttribution`）
  - [x] real-mode 冒烟（`smoke-tg.mjs`，测试 token 自签）：合法→201+verified=true / 篡改→400，gate 子运行已绿
  - [ ] **（human）** BotFather 建 bot + 托管 H5 + 切 `ATTRIBUTION_VERIFY=telegram` + 真实 token → 见 `TELEGRAM-SETUP.md`
- Verify（代码侧）: `./gate.sh`；（上线）: 见 TELEGRAM-SETUP.md §5
- Budget: 6 轮（用 1 轮）；**Human checkpoint: 注册真实 bot / 托管对外 / 真实 token / 发消息 必停（已停在此）。**

> 切任何真实供应商（Gemini/LiveKit/HelloTalk/RevenueCat）或对 Telegram 真实发消息 = 强制 human checkpoint。
