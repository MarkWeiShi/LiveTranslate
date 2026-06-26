# 真实音频语聊房上线手册（LOOP-R2 的 human checkpoint 部分）

> 代码侧已就绪：后端 **LiveKit token 签发**（`backend/src/adapters/media/livekit-media.transport.ts`，3/3 离线单测，用假 key 自签自验）。
> env 开关 `MEDIA_PROVIDER=mock|livekit` 已存在；默认 mock，gate 保持绿。
> **本文件的步骤需要你**：真实 LiveKit 凭据、客户端拾音、（可选）翻译 agent。Claude 不会代做。

## 架构（顺现有设计）
```
浏览器(mic) ──audio──▶ LiveKit 房间 ◀──audio── 浏览器(mic)
                         ▲  ▲
                         │  └── Python 翻译 agent（隐藏参会者）：STT→MT→TTS
                         │        · 订阅每路发言音频 → Gemini Live 翻译
                         │        · 发布"目标语"音频 + caption(DataChannel)
                         │        · 上报翻译秒数 → 后端 /internal/agent/report（唯一计费口）
              后端只做：签发 LiveKit token（已实现）+ 计费/付费墙/合规（已实现）
```
即：**后端不碰音频**；音频在 LiveKit，翻译三明治在 `agent/`（见 `agent/README.md`）。

## 已就绪（代码侧，本轮）
- `MEDIA_PROVIDER=livekit` 时，`POST /rooms` / `/rooms/:id/join` 返回**真实 LiveKit JWT**（roomJoin + canPublish/Subscribe，HS256 签名）。
- 离线已证明：签发的 token 可被同密钥 `TokenVerifier` 验过、错密钥失败、缺凭据报错。

## 你要做的（human checkpoint）

### 1. 拿 LiveKit 凭据
- LiveKit Cloud（有免费档）建项目，或自托管 livekit-server。
- 拿到 `LIVEKIT_URL`（wss://...）、`LIVEKIT_API_KEY`、`LIVEKIT_API_SECRET`。

### 2. 后端切真实媒体（`backend/.env`）
```
MEDIA_PROVIDER=livekit
LIVEKIT_URL=wss://<你的项目>.livekit.cloud
LIVEKIT_API_KEY=APIxxxx
LIVEKIT_API_SECRET=xxxx   # 勿提交
```
切完 `POST /rooms` 即返回真实 token。`MEDIA_PROVIDER=mock` 仍可随时切回（本机/CI）。

### 3. 客户端拾音 + 入房（✅ 代码已接，待你的 URL 联调）
- 已装 `livekit-client`（懒加载、仅 Web、仅 livekit 模式，默认 mock 为 no-op，不拖累构建）。
- 房间页进房后自动 `connectRoomAudio(token)`：`connect(LIVEKIT_URL, token)` + `setMicrophoneEnabled(true)` + 订阅他人音轨播放（`app/src/realtime/livekitAudio.ts`）。
- 启用：app 端设 env `EXPO_PUBLIC_TRANSPORT=livekit` + `EXPO_PUBLIC_LIVEKIT_URL=wss://...`，后端 `MEDIA_PROVIDER=livekit`。房间页顶部会显示「🎧 实时语音已接入」。
- ⚠️ 需真实 LiveKit 服务在线才能联调（拾音/播放）；代码与 H5 构建已验证（含 livekit-client），只差你的 URL。
- 字幕：真实模式可改由 agent 经 DataChannel 下发 `caption`；当前 UI 字幕流渲染可直接复用。

### 4. （可选）真实翻译 STT→MT→TTS
- 跑 `agent/`（LiveKit Agents + Gemini Live），并 `TRANSLATION_PROVIDER=gemini` + `GEMINI_API_KEY`（见 `agent/README.md`）。
- agent 加入房间做翻译三明治、上报计费——与 mock 同一计费/付费墙路径。

## 红线
- 真实 `LIVEKIT_API_SECRET` / `GEMINI_API_KEY` 不进 git、不进 Claude 上下文。
- 未联真实 LiveKit、未跑 agent、未对外——本轮仅服务端签发就绪 + 离线证明。

## 验证（你切真实后）
- `MEDIA_PROVIDER=livekit` 起后端 → `POST /rooms`（带登录 token）→ 返回的 token 用你的 `LIVEKIT_URL` 在 LiveKit 示例/客户端能入房 = 通。
- 两个浏览器入同一房推麦克风 → 能互听 = 音频通；再上 agent = 跨语言语音翻译闭环。
