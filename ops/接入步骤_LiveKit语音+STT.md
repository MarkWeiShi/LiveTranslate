# 接入步骤 · LiveKit 实时语音 + STT 语音听写（狼人杀）

> 关联：`LIVEKIT-SETUP.md`（原始手册）、`PRD_跨语言狼人杀.md`
> 现状：**代码全就绪**——后端 LiveKit token 签发、前端拾音/单麦、STT 听写均已开发并验证构建。
> 还差的只有 **LiveKit 凭据配置**（human checkpoint，需要你的账号）。STT **无需任何配置即可用**。
> 日期：2026-06-27

---

## 0. 两条语音链路（已分别落地）

| 链路 | 作用 | 依赖 | 状态 |
|---|---|---|---|
| **STT 听写**（Web Speech API） | 你说话 → 识别成你母语文字 → `wolfSpeak` → 后端翻成各听者母语字幕 | **无**（浏览器内置，免费） | ✅ 已开发，**直接可用** |
| **LiveKit 实时语音** | 让大家**听到彼此真实声音** | LiveKit 凭据 | ✅ 代码就绪，待你配 key |

> 二者互补：STT 负责"跨语言字幕"，LiveKit 负责"真人声音"。**不配 LiveKit 也能玩**——靠 STT 把语音转成翻译字幕。

---

## 1. STT 语音听写（零配置，已上线）

- 轮到你发言、麦克风开启时，浏览器自动把你的话识别成母语文本，整句完成即作为发言翻给全房（复用现有翻译扇出）。
- UI：发言行 🎙/🔇 切换；上方实时显示听写中的 interim 文本。
- **支持度**：Chrome / Edge / Android Telegram WebView 良好；**iOS Safari / 部分 WKWebView 不支持** → 自动降级为打字（显示"浏览器不支持语音识别"）。
- 需 HTTPS（GitHub Pages 已满足）+ 用户授权麦克风。
- 局限：Web Speech 识别质量依赖系统；嘈杂环境/小语种略弱。要更强可后续换服务端 STT（见 §4）。

---

## 2. LiveKit 实时语音（需你配凭据，约 5 步）

### 2.1 拿凭据
LiveKit Cloud（有免费档）建项目 → 拿 `LIVEKIT_URL`(wss://...)、`LIVEKIT_API_KEY`、`LIVEKIT_API_SECRET`。

### 2.2 后端切真实媒体（Fly secrets）
```bash
cd "/Users/mark/Projects/Top Repos/ParaEngine/LiveTranslate"
export PATH="$HOME/.fly/bin:$PATH"
fly secrets set \
  MEDIA_PROVIDER=livekit \
  LIVEKIT_API_KEY=APIxxxx \
  LIVEKIT_API_SECRET=xxxxxxxx \
  -a linku-backend-mark
# secrets 设置后 Fly 会自动滚动重启；LIVEKIT_URL 仅前端用，不必设后端
```
> 切回 mock：`fly secrets set MEDIA_PROVIDER=mock -a linku-backend-mark`

### 2.3 前端指向 LiveKit（GitHub Actions Variables）
仓库 Settings → Secrets and variables → Actions → Variables：
```
EXPO_PUBLIC_TRANSPORT  = livekit
EXPO_PUBLIC_LIVEKIT_URL = wss://<你的项目>.livekit.cloud
```
然后任意 push main（或手动 Run workflow）→ Pages 重建 → H5 接通真实语音。

### 2.4 验证
- 两个浏览器/设备登录不同账号、进同一对局号 → 轮到谁发言谁自动开麦 → 互相能听到声音 = LiveKit 通。
- 顶部状态显示「🎙 麦克风开启」而非「🎤 语音听写可用」。

---

## 3. 单麦规则（已实现，符合 PRD）

- 进房**静音**连接；**仅在自己发言轮自动开麦**（LiveKit 推流 + STT 听写同时启动），过麦/换人自动闭麦。
- 发言行 🎙/🔇 可手动静音/取消。
- 这天然契合狼人杀"轮流单麦发言"，也是实时翻译可行的前提（无语音重叠）。

---

## 4. （可选，后续）更强的语音翻译：服务端 STT→MT→TTS

当前 STT 是浏览器端、字幕走文本翻译。若要**听到"译后语音"**（而非只看字幕），按原 `LIVEKIT-SETUP.md` §4：
- 跑 `agent/`（LiveKit Agents + Gemini Live）作为隐藏参会者：订阅每路发言 → STT→MT→TTS → 发布译后音频 + caption(DataChannel)。
- 需 `TRANSLATION_PROVIDER=gemini` + `GEMINI_API_KEY`。
- 这才是完整"实时语音翻译三明治"；属较大工程 + 计费，按需启动。

---

## 5. 红线
- `LIVEKIT_API_SECRET` / `GEMINI_API_KEY` 只进 `fly secrets`，**不进 git、不进对话**。
- 未配凭据时一切照常（STT + 打字 + mock），gate 保持绿。
