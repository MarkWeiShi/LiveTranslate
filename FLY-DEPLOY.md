# 把 backend 部署到 Fly.io（后端上云，配合 GitHub Pages 前端打通整条链路）

> 代码侧已就绪：`Dockerfile`（仅装 backend + shared，ts-node 运行）、`fly.toml`（全 mock env + SQLite 挂载卷 + 512MB）、`.dockerignore`。
> 全 mock、零第三方密钥即可跑。**装 flyctl / 登录 / deploy 需要你**（你的 Fly 账号 + 计费；本机沙箱不允许装 flyctl，也无 Docker）。Fly 用远程构建器，无需本地 Docker。

## 你要跑的命令（约 5 步）

```bash
cd "/Users/mark/Projects/Top Repos/ParaEngine/LiveTranslate"

# 1) 装 flyctl
curl -L https://fly.io/install.sh | sh
export FLYCTL_INSTALL="$HOME/.fly"; export PATH="$FLYCTL_INSTALL/bin:$PATH"

# 2) 登录（浏览器授权）
fly auth login

# 3) 创建 app（用本仓 fly.toml；app 名需全局唯一，按提示改名，比如 linku-backend-mark）
fly apps create linku-backend-mark      # 改成你的唯一名
#   并把 fly.toml 第一行 app = "..." 改成同名

# 4) 建 SQLite 持久卷（与 fly.toml 同 region）
fly volumes create data --size 1 --region hkg --yes

# 5) 设密钥 + 部署
fly secrets set JWT_SECRET="$(openssl rand -hex 32)"   # 生产 JWT 密钥
fly deploy --remote-only
```

部署完拿到后端地址：`https://<你的 app 名>.fly.dev`。

## 把前端接到这个后端

在 GitHub 仓库 Settings → Secrets and variables → Actions → Variables 设：
```
EXPO_PUBLIC_API_BASE = https://<你的 app 名>.fly.dev
EXPO_PUBLIC_WS_BASE  = https://<你的 app 名>.fly.dev
```
然后随便 push 一下 main（或 Actions 里 Run workflow）→ Pages 自动重建 → 线上 https://markweishi.github.io/LiveTranslate/ 的登录/语聊房/成长就真能调通后端了。
> 后端 CORS 已是 `cors:true`，允许 Pages 源；归因/Telegram 仍 mock，安全。

## 验证

```bash
curl -X POST https://<你的 app 名>.fly.dev/auth/hellotalk/callback \
  -H 'Content-Type: application/json' -d '{"mockUserId":"seed_male_01"}'
# 返回 {token,user,...} = 后端在线（已自动迁移+种子 4 个 mock 账号）
fly logs        # 看启动日志
fly status      # 机器/卷状态
```

## 说明 / 取舍
- **DB**：MVP 用 SQLite 落在 Fly 卷（`/data/prod.db`），单机。扩容/多机时改 Postgres：schema 的 `provider` 改 `postgresql`、`fly postgres create` 并把 `DATABASE_URL` 设为其连接串、重生成迁移。
- **启动**：容器启动自动 `prisma migrate deploy` + 种子（幂等 upsert，仅 mock 演示账号）+ ts-node 起服务。
- **成本**：`auto_stop_machines=stop` + `min_machines_running=0` → 空闲自动停机省钱；首个请求冷启动稍慢。
- **真实供应商**（Gemini/LiveKit/HelloTalk/RevenueCat）：`fly secrets set` 注入 key 并把对应 `*_PROVIDER` 改真即可（human checkpoint）。
- 想自动化 CI 部署后端，可加 Fly 的 GitHub Action（用 `FLY_API_TOKEN` secret）——需要时我可生成。
