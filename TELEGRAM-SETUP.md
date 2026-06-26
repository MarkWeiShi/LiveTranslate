# Telegram 真实入口上线手册（LOOP-L3 的 human checkpoint 部分）

> 代码侧已就绪：服务端 HMAC 校验（`backend/src/attribution/telegram-verify.ts`，5/5 单测）、
> env 开关（`ATTRIBUTION_VERIFY=mock|telegram` + `TELEGRAM_BOT_TOKEN`）、归因记录（`verified` 字段）。
> **本文件列出的步骤需要你（人）完成**——涉及真实 BotFather 账号、真实 token、对外托管。Claude 不会代做。

## 为什么这部分必须你来做（红线）
- 注册 bot / 拿 token 是 **BotFather 交互操作**（你的 Telegram 账号）。
- token 是**生产密钥**，不进 git、不进 Claude 上下文。
- 托管 H5 + 设置 Mini App URL 是**对外上线**，不可逆、面向真实用户。
- 发送任何 Bot 消息 = 对外动作，需你明确发起。

## 步骤

### 1. BotFather 建 bot + Mini App（你操作）
1. Telegram 找 `@BotFather` → `/newbot` → 拿到 `TELEGRAM_BOT_TOKEN`（形如 `123456:ABC...`）。
2. `/newapp`（或 `/mybots → Bot Settings → Configure Mini App`）→ 绑定一个 **Mini App URL**（= 下一步托管的 H5 地址）。
3. （可选）设置 Menu Button / `/setdomain` 指向同一域名。

### 2. 托管 H5（✅ GitHub Pages 已配好工作流）
**GitHub Pages 可用**：默认 HTTPS（Telegram Mini App 硬性要求）。已为你加好自动部署：
- 工作流：`.github/workflows/deploy-pages.yml`（push 到 `main` 或手动触发 → 导出 Expo Web → 部署 Pages）。
- 已处理 GH Pages 三个坑：子路径 `baseUrl`（`app/app.config.js` 按 `EXPO_PUBLIC_BASE_URL` 注入）、`.nojekyll`（否则 `_expo` 被 Jekyll 忽略白屏）、`404.html` SPA 回退。
- 已本地验证：设 `EXPO_PUBLIC_BASE_URL=/LiveTranslate` 后，`index.html` 资源前缀正确变为 `/LiveTranslate/_expo/...`。

**你要做的一次性配置（GitHub 仓库 Settings）**：
1. Settings → Pages → Build and deployment → Source = **GitHub Actions**。
2. Settings → Secrets and variables → Actions → **Variables** 新增：
   - `EXPO_PUBLIC_API_BASE` = `https://<你的后端域名>`（**必填**：H5 调后端归因/登录/通话）
   - `EXPO_PUBLIC_WS_BASE` = `https://<你的后端域名>`（实时通话信令；暂无可留空）
   - `EXPO_PUBLIC_BASE_URL` = `/LiveTranslate`（项目页子路径默认值；**用户页/自定义域名根路径则填 `/`**）
3. push 到 `main`（或 Actions 里手动 Run workflow）→ 部署完成。
4. Mini App URL 填：`https://<用户名>.github.io/LiveTranslate/`（与 baseUrl 对应）。

> ⚠️ **GitHub Pages 只能托管静态 H5，跑不了 NestJS 后端。** 你的 `backend` 要单独部署到一个 HTTPS 后端
> （Render / Railway / Fly.io 等），其域名填入上面的 `EXPO_PUBLIC_API_BASE`。后端就绪前 Mini App 能打开，
> 但归因/登录会失败（前端 fire-and-forget，不崩）。后端 CORS 已是 `cors:true`，允许 Pages 源。
> initData 读取已做 `location.hash` 兜底，纯静态托管也能拿到（无需 telegram-web-app.js）。

### 3. 后端切真实校验（你操作，1 行 env）
在 `backend/.env`：
```
ATTRIBUTION_VERIFY=telegram
TELEGRAM_BOT_TOKEN=123456:ABC...   # 来自步骤 1，切勿提交
```
切换后：`POST /attribution` 会对 `tgWebAppData` 做 HMAC 校验，**非法 initData 返回 400**，合法记录 `verified=true`。
mock 模式（默认）不校验、`verified=false`——本机/CI 用。

### 4. 前端启动上报（✅ 已接线，无需你写代码）
app 启动时已自动上报：`app/src/telegram/launchAttribution.ts`（在 `app/_layout.tsx` 调用）。
逻辑：H5 在 Telegram 内启动 → 读 `Telegram.WebApp.initData` → `POST /attribution`；非 Telegram 环境无操作、失败静默。
托管到 Telegram Mini App 后即自动生效，无需改动。
> **信任判定一律以后端 `verified` 为准**（真实模式做 HMAC 校验）。

> CI 已用「测试 token 自签」证明真实模式 HTTP 链路（`backend/scripts/smoke-tg.mjs`，gate `[6b]`）：合法→201+verified=true、篡改→400。
> 你切真实 token 后行为一致，只是 token 变成 BotFather 的真实串。

### 5. 验证（切真实后）
- 在 Telegram 里打开 Mini App → 后端应出现一条 `source=telegram, verified=true` 的归因。
- 用 `GET /internal/attribution/count?source=telegram`（带 `x-agent-token`）查计数。
- 篡改 initData 或用错 token → 应被 400 拒绝（逻辑已被 `telegram-verify.test.ts` 离线证明）。

## 不在本轮范围（后续 loop）
- Bot 主动发消息 / 推送（又一次 human checkpoint）。
- 归因 `userId` 回填（注册闭环）——可全 mock 先做，属下一个安全 loop。
- 邀请裂变（`start_param=ref_<inviterId>` → 奖励）——可 mock 先做漏斗。
