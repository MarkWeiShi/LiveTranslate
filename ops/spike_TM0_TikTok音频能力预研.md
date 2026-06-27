# Spike · TM0 · TikTok Mini Games 运行时音频能力预研

> 母文档：`落地方案_TikTok第二根据地.md`（TM0 + TG1-1）、`PRD_跨语言狼人杀.md`（§5 翻译交互、§3.4 单麦机制）
> 工程：`experiments/tiktok-audio-spike/`（本 spike 的可运行探针工程）
> 性质：**时间盒 spike**（建议 3–5 人日）—— 用一个最小可运行的 TikTok 小游戏探针，**实测** Minis 运行时到底支持哪些音频能力，输出"狼人杀 Mini Game 走哪条形态"的 go/no-go 结论。
> 版本：v0.1 ｜ 日期：2026-06-27 ｜ 状态：待启动

---

## 0. 一句话目标

> **回答一个决定战线一形态的问题：TikTok Mini Games 运行时能不能跑"发言者母语语音 → 实时翻译 → 其他人听到/看到译文"这条链路？能到什么程度（实时全双工 / 半双工 / 推到talk / 仅文字）？据此锁定狼人杀 Mini Game 的最终形态与工程量。**

---

## 1. 背景与核心未知

**为什么这是 P0 阻塞项**：现有 App（`app/src/realtime/livekitAudio.ts`）的实时语音靠 **LiveKit（浏览器 WebRTC：`RTCPeerConnection` / `getUserMedia` / `<audio>`）**。但 **TikTok Mini Games 运行时不是浏览器**——它是 canvas + JS 引擎 + `tt.*` 全局 API 的小游戏沙箱，**大概率没有 DOM、没有 WebRTC、没有 getUserMedia**。所以现有音频栈在 Mini Game 里**几乎确定不能直接复用**，必须改走 `tt` 原生音频 API。这条路能走多远，是未知，必须实测。

**关键洞察（把"全有或全无"拆成"分层降级"）**：狼人杀对音频的需求是**分层**的，不是一个开关——

| 层 | 能力 | 依赖 | 现状判断 |
|---|---|---|---|
| **L-base 推理主通道** | **文字字幕**（发言译文、AI 主持旁白、私密提示） | 仅 WebSocket 传文本 | ✅ 已在 `packages/shared/src/werewolf.ts` 定义（`SPEECH`/`HOST`/`PRIVATE` 全是文本事件）——**与音频能力无关，几乎确定可行** |
| **L-enh1 译文配音** | 接收端播放 TTS 译文（氛围增强） | 音频**播放**能力 | 待测（playback 通常最易得） |
| **L-enh2 原声采集** | 采集发言者麦克风语音做 STT | 音频**录音**能力 | 待测（录音是关键变量） |
| **L-ideal 实时语音** | 房内实时听到彼此原声 | VoIP/实时音频 | 待测（最不确定） |

> **因为狼人杀是「单麦 + 回合制」（PRD §3.4 强制单麦），它根本不需要全双工 WebRTC**——同一时刻只有 1 人发言。半双工、甚至"按住说话(PTT)→上传→翻译→别人收"都满足玩法。这把对运行时的要求从"必须有 WebRTC"降到"有录音 + 播放 + 一条上行通道即可"，**大幅提高可行概率**。PRD §5.1 本就把**字幕设为推理主通道、TTS 设为次要**——这与降级方向天然一致。

---

## 2. 验证项清单（Probe Matrix）

> 每个 probe 对应 `experiments/tiktok-audio-spike/src/probes/` 下一个文件，**防御式 feature-detection**（先 `typeof api.xxx`，再 try/catch 实测），不假设任何 API 存在。结果统一产出 `{id,name,status,detail,data}`，status ∈ `pass|partial|absent|fail|error`。

| Probe | 验证能力 | 候选 API（feature-detect） | 实测方法 | 期望 / 判定 |
|---|---|---|---|---|
| **P1 运行时能力探测** | 运行时到底有哪些 API | 枚举 `tt`/`wx`/`globalThis`；逐个 `typeof`：`createInnerAudioContext`、`getRecorderManager`、`joinVoIPChat`、`connectSocket`、`getFileSystemManager`、`authorize`、`getSystemInfoSync`、`RTCPeerConnection`、`getUserMedia` | 启动即跑，打印能力清单 | 产出"运行时能力地图"——后续 probe 据此选跑 |
| **P2 音频播放** | 能否播放音频（TTS 配音落地） | `tt.createInnerAudioContext` | 播本地短音频 + 远程 URL 音频 + （若支持）流式/PCM 喂入 | 能播本地&远程→L-enh1 可行；支持流式→实时 TTS 更顺 |
| **P3 录音采集** | 能否采麦克风（STT 上行落地） | `tt.getRecorderManager`：`start/stop/onFrameRecorded/onStop` | ①能否 start 录音；②`onFrameRecorded` 是否**分片回调**（=可流式上行）；③格式/采样率（pcm/mp3/aac、16k?） | 有分片帧→半双工流式可行(L1)；只 start/stop 出文件→PTT 可行(L2)；无录音→L3 |
| **P4 实时语音 VoIP** | 有无原生实时房 | `tt.joinVoIPChat`/`exitVoIPChat`/`onVoIPChatMembersChanged`/`updateVoIPChatMuteConfig` | 探测是否存在；存在则两端实测能否互通 | 存在且可用→L0 理想态；不存在→走 L1/L2 |
| **P5 自建 WS 音频链路** | 没有 VoIP 时能否自建 | `tt.connectSocket`（SocketTask：send/onMessage，二进制帧?） | 录音帧经 WS 上行到 `server/echo-server.js`，回环下行再播放 | WS 通 + 可传二进制→自建 relay 成立（L1/L2 的承载） |
| **P6 权限与合规** | 麦克风授权与拒绝降级 | `tt.authorize({scope:'scope.record'})`、`getSetting`、`openSetting` | 申请录音权限；模拟拒绝→是否能引导 openSetting；纯听者免授权路径 | 授权流程可控 + 拒绝有降级（只听/只字幕） |
| **P7 端到端延迟** | 对齐 PRD 延迟预算 | P3+P5+P2 串起 | 录音帧→WS→服务端回环→播放，测 P50/P90 单程与回环延迟 | 对照 PRD：字幕首字<1s、整段<2s、TTS<3s |

---

## 3. 降级路径（Degradation Ladder）

> 按 probe 结果落到某一级；**每一级都有一个可上线的狼人杀形态**，不存在"测不通就全废"。

| 级别 | 触发条件（probe 结果） | 狼人杀 Mini Game 形态 | 体验 | 工程量 |
|---|---|---|---|---|
| **L0 实时语音** | P4 VoIP 可用 | 房内实时听原声 + 字幕译文 + TTS | ≈ 现有 LiveKit 体验 | 中（接 VoIP + 翻译旁路） |
| **L1 半双工流式** | P4 无；P3 有分片帧 + P5 WS 通 | 发言者说话边录边上行 → STT/MT → 听者**字幕(主)+TTS(次)**；单麦回合制天然无冲突 | 准实时，字幕快、配音略延迟 | 中（录音帧→WS→翻译→TTS 回推） |
| **L2 按住说话 PTT** | P3 只能 start/stop 出文件 | 发言者"按住说话"→停→上传整段→STT/MT→听者字幕+TTS | 回合制可接受（每人 45–90s 一段） | 中小（录文件→上传→翻译） |
| **L3 纯文字推理版** | P3 无可用录音 | 发言者**打字**发言（或仅 AI 玩家语音）→译文字幕；TTS 旁白若 P2 可用则保留 | 失去"开口"体感，但完整推理仍成立 | 小（复用 werewolf.ts 文本协议） |
| **L-fallback 形态分流** | L3 仍嫌弱 | **Mini Game 主打文字/异步推理拉新；真实语音体验放到 TM1 的 LIVE 多人连麦载体** | 双载体分工 | —（落地方案已含 LIVE 线） |

> 注：**L-base 文字字幕在每一级都在**（werewolf.ts 已就绪）。降级降的是"语音增强"，不是"游戏可玩性"。

---

## 4. 判定标准（Decision Matrix）

> spike 结束输出一张表 + 一个结论。判定看两件事：**能力存在性**（probe status）+ **延迟是否达标**（P7 对照 PRD 预算）。

| 结论 | 条件 | 行动 |
|---|---|---|
| ✅ **GO · L0/L1** | P4 可用 **或**（P3 分片帧 + P5 WS + P7 字幕<2s 达标） | 狼人杀 Mini Game 走实时/半实时语音，进 TG1-2 平台适配层正式开发 |
| 🟡 **GO · L2** | 仅 PTT 可行（P3 文件 + P5 WS + 上传翻译往返可接受） | 走 PTT 形态先上线（回合制能扛），把流式列为 P1 优化 |
| 🟡 **GO · L3** | 录音不可用，但 P2 播放 + WS 文本通 | Mini Game 先做**文字推理版**拉新，**实时语音收口到 LIVE（TM1）** |
| 🔴 **NO-GO（Mini Game 语音）** | 运行时音频能力严重缺失/延迟远超预算且无降级 | 战线一仅做轻量小游戏(问答/你画我猜)，狼人杀语音主战场转 LIVE |

**延迟达标线（沿用 PRD §5.1）**：字幕首字 < 1.0s、整段 < 1.5–2s、TTS < 3s（异步追赶）。**字幕是主通道**——只要字幕达标，即便 TTS 慢也判 GO。

---

## 5. Spike 工程（experiments/tiktok-audio-spike/）

**目标**：一个能在 **TikTok DevTool** 里打开就跑的最小小游戏，逐个执行 probe，把"能力地图 + 延迟数据 + 判定建议"渲染到屏幕并导出 JSON 报告。

```
experiments/tiktok-audio-spike/
  README.md            # 运行手册（注册 appid → DevTool 打开 → 点屏跑交互 probe → 导出报告）
  game.json            # TikTok 小游戏配置
  project.config.json  # DevTool 工程配置（填 appid）
  game.js              # 入口：编排 probe、canvas 渲染报告、导出 JSON
  src/
    report.js          # 报告聚合 + canvas 渲染 + 文件导出
    env.js             # 运行时 api 适配（tt / wx / globalThis 归一）
    probes/
      p1-capabilities.js   # 运行时能力探测（启动即跑）
      p2-playback.js       # 音频播放（本地/远程/流式）
      p3-recorder.js       # 录音（分片帧 vs 文件、格式、采样率）
      p4-voip.js           # 实时语音 VoIP 探测
      p5-websocket.js      # WS 自建音频链路 + 二进制
      p6-permission.js     # 录音授权与拒绝降级
      p7-latency.js        # 端到端延迟测量（录音→WS→回环→播放）
  server/
    echo-server.js     # 极简 Node WS 回环服务（P5/P7 用，原样回传帧并打时间戳）
    package.json
```

**运行流程**：① 在 TikTok 开发者后台建 Mini Game 拿 appid 填进 `project.config.json` → ② `node server/echo-server.js` 起回环服务（填进 `env.js` 的 WS 地址）→ ③ DevTool 打开工程，P1/P2/P5 自动跑，P3/P4/P6/P7 需**点屏触发**（麦克风需用户手势）→ ④ 屏幕显示能力地图与延迟，右上"导出报告"落 JSON。

**产出物**：`CAPABILITY-REPORT.json`（每 probe 的 status/detail/data + 运行时 systemInfo + P7 延迟分布 + 自动判定建议）。

---

## 6. 排期与产出物

| 步 | 内容 | 估 |
|---|---|---|
| S1 | 注册 Mini Game appid + DevTool 跑通空工程 + P1 能力地图 | 0.5–1 人日 |
| S2 | P2 播放 + P3 录音 + P6 权限（本地能力） | 1 人日 |
| S3 | P5 WS + echo-server + P4 VoIP 探测 | 1 人日 |
| S4 | P7 端到端延迟串联 + 报告导出 + 判定 | 1 人日 |
| S5 | 写结论：落级别 + go/no-go + 形态建议（回填 `落地方案` TM0 待决策项 1） | 0.5 人日 |

**唯一交付**：一份 `CAPABILITY-REPORT.json` + 一段结论（命中哪一级、是否 GO、狼人杀 Mini Game 形态定型），直接解掉 `落地方案_TikTok第二根据地.md` §8 待决策项 1，让 TG1-2 起步。

---

## 7. 风险与依赖

| 风险/依赖 | 说明 | 对策 |
|---|---|---|
| appid 审批耗时 | DevTool 需注册主体 + appid | 提前申请；等待期先在普通浏览器跑 probe 骨架验证逻辑 |
| DevTool ≠ 真机 | 模拟器可能"有 API 真机受限" | 关键 probe（录音/VoIP/延迟）**必须真机复测** |
| API 名猜测 | 候选 API 名未必准 | P1 用枚举式 feature-detect，**发现** API 而非假设；按实测结果回填本表 |
| 二进制帧传输 | WS 是否支持 ArrayBuffer | P5 显式测二进制；不支持则 base64 兜底（计入延迟） |

---

## 8. 收束

> **TM0 不是"赌 TikTok 有没有 WebRTC"，而是"沿降级阶梯实测落到哪一级"——而狼人杀的单麦回合制 + werewolf.ts 已就绪的文字协议，保证了最差也有 L3 文字推理版可上线、实时语音可转 LIVE。spike 的唯一任务是用 `experiments/tiktok-audio-spike` 跑出一张能力地图 + 延迟数据，把形态从"未知"变成"L0–L3 之一 + go/no-go"，让战线一正式开工。**

---

## 附：信息来源（2025–2026 核实）

- Mini Games SDK / Native runtime / DevTool：[developers.tiktok.com — Develop Your Mini Game](https://developers.tiktok.com/doc/develop-your-mini-game)、[Mini Games SDK Get Started](https://developers.tiktok.com/doc/mini-games-sdk-get-started)、[Debug Your Mini Game](https://developers.tiktok.com/doc/debug-your-mini-game)
