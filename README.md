# LinkU — 跨境 1v1 实时翻译社交 MVP（赛道一）

基于 `PRD_赛道一_LinkU_MVP工程级BuildSpec.md` 实现的可运行 MVP。核心链路：
**HelloTalk 登录（Mock）→ 发现异国异性 → 1v1 实时翻译视频 → 试用额度用尽进付费墙 → 举报/拉黑安全闭环 → 通话历史**。

> 默认全 Mock，本机零密钥端到端可运行；后续按 env 一键切真实（Gemini Live / LiveKit / HelloTalk OAuth / RevenueCat）。

## 现状（已验证）

- ✅ **后端全部 13 条验收标准通过**，27/27 冒烟断言绿（见下）。
- ✅ **Web App 类型检查通过 + 生产 web 包构建成功**（`expo export -p web`，735 模块）。
- 全 Mock 模式，无需任何第三方密钥即可运行。

| 验收 | 覆盖 | 验证脚本 |
|---|---|---|
| AC-AUTH-1/2 | 登录导入画像 / 不重复建号 | `scripts/smoke.mjs` |
| AC-DISC-1 | 异性+在线筛选、实人>信任排序、离线排除、拉黑排除 | `scripts/smoke.mjs` |
| AC-CALL-1 | 来电信令 + 接听 + 双方进房 | `scripts/smoke-rt.mjs` |
| AC-XLATE-1/2 | 双语字幕流 + 状态；失败降级为字幕 | `scripts/smoke-rt.mjs` |
| AC-PAY-1/2/3 | 试用耗尽付费墙 / 订阅恢复 / 并发通话拒绝 | `scripts/smoke-rt.mjs` |
| AC-SAFE-1/2 | 诈骗话术风险提示 / 举报+拉黑+不可再呼叫 | 两个脚本 |
| AC-REL-1 | 通话历史含时长+翻译时长 | `scripts/smoke-rt.mjs` |

## 架构

Monorepo（npm workspaces）：

```
LiveTranslate/
├─ packages/shared/   @linku/shared — DTO/事件/枚举/常量（仅源码，无构建步骤）
├─ backend/           NestJS 11 + Prisma 7 (SQLite) + Socket.IO 网关
├─ app/               Expo SDK 52 (RN + react-native-web)，Web 优先
└─ agent/             Python 翻译 agent 占位（仅切真实 Gemini 时使用）
```

- **后端是唯一计费记账方**：实时翻译试用秒数只在后端 `TranslationSession` 扣减；Mock 由每秒 tick 驱动，真实由 Python agent 经同一 `POST /internal/agent/report` 上报。
- **所有第三方走适配器**（`backend/src/adapters/*`），env 选择 mock/real。
- **媒体**：Web 用浏览器 WebRTC，SDP/ICE 经后端 WS（`/ws`）在 localhost 中继 —— 两个浏览器窗口即可互看摄像头，无需 STUN/TURN/账号。

## 环境要求

- Node ≥ 20（已在 Node 24 验证；为兼容 Expo SDK 52 工具链，根 `package.json` 用 `overrides` 锁定 `react-native@0.76.9` + `metro@0.81.5`）。
- 无需 Docker / Postgres / Redis（用 SQLite + 内存态）。

## 安装 & 运行

```bash
# 1) 安装
npm install

# 2) 建库 + 种子（SQLite）
npm -w backend run prisma:generate
npm -w backend run prisma:migrate     # 首次创建 dev.db
npm -w backend run seed               # 写入 4 个种子用户

# 3) 同时启动后端(:3000) + Web(:8081)
npm run dev
# 或分开： npm run backend    /    npm run web
```

`backend/.env` 与 `app/.env` 已含全 Mock 默认值（见 `.env.example`）。

## 两窗口手动演示（核心闭环）

1. 用**两个独立浏览器窗口/隐身窗口**打开 Web（终端打印的 `http://localhost:8081`），都授权相机+麦克风。
2. 窗口 A 登录 `Wei 魏 (zh)`，窗口 B 登录 `María (es)`。
3. A 在「发现」筛选 女/仅在线 → 看到 María → 进详情 → **📹 视频通话**。
4. B 弹出来电 → 接听 → 双方互见摄像头（AC-CALL-1）。
5. 观察底部**双语字幕流**（"¿Qué tal tu día?" → "你今天过得怎么样？"）与顶部「翻译中·剩余试用」（AC-XLATE-1）。
6. 试用耗尽 → 弹**付费墙**，原音恢复、通话继续 → 选月度订阅恢复翻译（AC-PAY-1/2）。
7. 通话中对方说出诈骗话术 → **风险横幅**（AC-SAFE-1）。
8. 挂断 → 「记录」Tab 显示含时长+翻译时长的通话（AC-REL-1）。

> 单摄像头机器：设 `app/.env` 的 `EXPO_PUBLIC_MOCK_MEDIA=loopback`，仍可演示字幕/付费墙（远端画面用本地流占位）。

## 无头验证（冒烟测试）

后端运行后：

```bash
node backend/scripts/reset-dev.mjs      # 清理悬挂通话 + 重置钱包
node backend/scripts/smoke.mjs          # HTTP: AUTH/DISC/SAFE-2/friends（12 断言）
node backend/scripts/reset-dev.mjs
node backend/scripts/smoke-rt.mjs       # 实时: CALL/XLATE/PAY/SAFE-1/REL（15 断言）
```

类型检查：`npm run typecheck`（shared + backend + app 全过）。

## Mock → 真实 切换（皆为 env 翻转）

| 依赖 | env（backend/.env） | 切真实需要 |
|---|---|---|
| HelloTalk 鉴权 | `AUTH_PROVIDER=hellotalk` | OIDC 凭证 + `HELLOTALK_*` |
| 音视频 | `MEDIA_PROVIDER=livekit` | `LIVEKIT_*` + 客户端换 livekit SDK |
| 翻译 | `TRANSLATION_PROVIDER=gemini` | `GEMINI_API_KEY` + 启 `agent/`（见 agent/README.md） |
| 支付 | `PAYMENT_PROVIDER=revenuecat` | `REVENUECAT_API_KEY` + 原生构建 |
| 数据库 | `DATABASE_URL` + schema provider | 改 `postgresql` 重新 migrate |
| 缓存 | `STORE_DRIVER=redis` | Redis 驱动 + `REDIS_URL` |

## 相对 PRD 的简化（本机约束）

- **Web 优先**（PRD 列 Web 为 OUT）：本机无 Android 模拟器/Java/Xcode；RN 代码保留，原生为后续 `expo run` 目标。
- **SQLite + 内存态** 替代 Postgres+Redis（无 Docker）；接口化，生产改 datasource/driver。
- **后端 Mock 翻译循环** 替代 Python LiveKit agent（无 Gemini/LiveKit 密钥）；同一计费入口。
- 这些都是 env/配置翻转，非产品代码重写。
