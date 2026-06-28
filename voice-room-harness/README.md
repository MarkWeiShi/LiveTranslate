# 语聊房逆向采集 Harness（BIGO 完全复刻用）

按 `../voice-room-browser-harness.md` 实现的可运行版（Node + Playwright + Claude Vision）。
**采集步骤需要你的 BIGO 账号 + 真实进房**（Claude 无法代登录/代付费送礼）。采到 `spec.json` 后发我，我据此把语聊房复刻到完全一致。

## 安装（一次）
```bash
cd voice-room-harness
npm i
npx playwright install chromium
```

## 1. 采集（你来跑）
BIGO 语聊房在 App 内，Web 是视频间；多人「互动直播」最接近。用 **headful + 手动** 模式：
```bash
HEADFUL=1 node capture.mjs https://www.bigo.tv/ homepage --wait --mobile
```
- 浏览器弹出后：手动登录 → 进入一个互动/语聊房间 → 按提示逐个抓状态：
  `room_entry` / `mic_seat_speaking` / `gift_panel_open` / `gift_sending` / `gift_fullscreen` / `leaderboard_open` / `apply_mic_queue` …
- 每抓一态输入状态名回车；直接回车结束。
- 产物：`out/<state>.png` + `out/<state>_dom.json` + `out/ws_frames.json`。

> 送礼/全屏特效需要充值少量金币才能触发，按需。

## 2. 生成 spec（Vision）
```bash
ANTHROPIC_API_KEY=sk-... node analyze.mjs
# → out/spec.json（每个状态的组件清单 + 布局 + 动画 + 配色）
```

## 3. 复刻
把 `out/spec.json`（和关键截图）发我 → 我据此把 `app/app/babel.tsx` 语聊房改到与 BIGO 完全一致（布局/配色/动效/交互）。

## 说明 / 取舍
- 仅采集**自己有权访问**的公开/自有内容，遵守目标站 ToS；勿绕过反爬、勿抓他人隐私。
- WS 多为 Protobuf 二进制，脚本只存可读片段做协议草图。
- 不依赖 Anthropic SDK，直接 REST 调用。
