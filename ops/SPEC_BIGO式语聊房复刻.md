# 实现 SPEC · BIGO 式麦位语聊房（复刻到 babel 语聊房）

> 参考：`voice-room-browser-harness.md`（逆向采集方案，需真实账号/充值，未实跑）。
> 本 SPEC 按 **BIGO Live 语聊房成熟设计语言**直接实现到现有「巴别塔语聊房」(`app/app/babel.tsx`)。
> 复用：现有 ROOM WS 事件、Moti、DiceBear 头像、wolf 主题。日期：2026-06-28

---

## 0. 取舍说明
- harness 那套 Playwright+Vision 需要 BIGO 真实账号、充值送礼、headful 浏览器、且 BIGO 语聊房在 App 内（Web 是视频间）——**不实跑**。
- 改为**从已知 BIGO 设计语言直接复刻**：麦位中心布局 + 说话波纹 + 礼物面板/飘屏 + 底部操作条 + 公屏消息。
- 真实"谁在说话"：mock/打字模式下，由"某用户发了字幕/弹幕"→ 该麦位高亮 2.5s 近似；接 LiveKit 后可换 ActiveSpeaker。

---

## 1. 布局（移动 390 宽，BIGO 经典 9 麦）
```
┌─────────────────────────────┐
│ ← 房间名 · 在线N        ⚙   │  顶栏
│        [房主大麦位]          │  host seat（金环、居中、更大）
│   1   2   3   4              │  8 个普通麦位（2×4）
│   5   6   7   8              │
│                             │
│ 公屏消息（半透明滚动）        │  message area（含进房通知/弹幕/字幕）
│ [礼物飘屏覆盖层]             │  gift fly overlay（绝对定位）
│ 🎙  说点什么…   😀  🎁  🎮  │  底部操作条
└─────────────────────────────┘
```

## 2. 组件清单（→ 落地文件）
| BIGO 组件 | 交互 | 落地 |
|---|---|---|
| 麦位卡（头像/昵称/麦序/静音图标/魅力值/说话波纹） | 点空位=举手上麦；点头像=看资料/送礼 | `components/voiceroom/MicSeat.tsx` |
| 房主大麦位 | 同上，金环高亮 | MicSeat variant=host |
| 说话波纹 | 说话时同心圆扩散 | Moti loop ripple |
| 公屏消息区 | 进房通知/弹幕/字幕滚动 | babel 内联（复用 caption/barrage/join） |
| 底部操作条 | 🎙麦克风 / 输入 / 😀弹幕 / 🎁礼物 / 🎮游戏 | babel 内联 |
| 礼物面板 | 底部上滑、礼物网格、余额、数量、赠送 | `components/voiceroom/GiftPanel.tsx` |
| 礼物飘屏 | 小礼物飘动 + 连击；大礼物全屏 | `components/voiceroom/GiftFly.tsx`（Moti） |
| 魅力值/贡献 | 麦位下累计收礼钻石 | 客户端按 gift 事件累计 |

## 3. 礼物系统（最小后端联动）
- 新增 WS 事件 `ROOM_EVENTS.GIFT` + `POST /rooms/:id/gift`：把 `{fromName, giftType, toSeat}` 广播给全房 → 各端播放飘屏 + 累计魅力值。
- 礼物目录（前端常量）：🌹玫瑰1 / 🍺啤酒9 / ❤️爱心66 / 👑皇冠199 / 🚀火箭520 / 🏰城堡1314（coins）。
- coins≥199 视为"大礼物"→ 全屏特效；否则小飘屏 + 连击。
- 余额取 `wallet().diamonds`（mock 不强制扣减）。

## 4. 动效（Moti）
- 说话波纹：麦位头像外 2 圈 `scale 1→2 opacity .6→0` loop。
- 礼物飘屏：从底部礼物按钮飞向目标麦位/中心 + 缩放弹入；大礼物中心放大 + 渐隐。
- 礼物面板：底部 `translateY` 上滑 spring。
- 进房通知：消息行淡入。

## 5. 复用的现有 WS（不重造）
- `MEMBER_JOINED/LEFT` → 麦位增减 + 进房通知
- `CAPTION`（utterance 翻译字幕）/ `BARRAGE`（弹幕）→ 公屏 + 说话高亮
- `QUEUE_UPDATED`（举手）→ 麦序标记
- `TELEPHONE_*` / `QUIZ_*` → 「🎮 游戏」入口（保留）
- 新增 `GIFT`

## 6. 验收
- typecheck + `expo export web` 通过；不破坏现有语聊房 smoke。
- 视觉：9 麦位网格 + 房主金环 + 说话波纹 + 礼物面板/飘屏 + 底部条；公屏滚动；跨语言字幕仍工作。
