# 落地方案 · TikTok 第二根据地（Mini Games + LIVE 双载体）

> 母文档：`FB·IG·X·TikTok_社交娱乐小程序机会与变现分析.md`（§2 结论：TikTok 是唯一值得"建产品"的第二根据地）、`Telegram生态_社交赛道机会分析.md`（渠道战略）、`AGI时代社交产品_框架思考.md`（产品框架）
> 联动：`PRD_跨语言狼人杀.md`（旗舰玩法载荷）、`Telegram玩法_语聊房可借鉴机制清单.md`、`Instagram Comment-to-DM 多账号方案评估.md`、`教案 J3/J5`（矩阵养号 + 爆款内容）
> 性质：与 PRD 平级的落地方案 —— **Mini Games 上架路径 + LIVE 公会冷启 + 与 TG 的双根据地导流闭环**，含可排期需求列表与里程碑。
> 版本：v0.1 ｜ 日期：2026-06-27 ｜ 状态：待评审

---

## 0. 一句话方案定义

> **把已立项的「跨语言狼人杀/问答」同时投到 TikTok 的两个原生载体——Mini Games（即点即玩小游戏，吃满算法分发 + IAP/IAA）和 LIVE 多人连麦（现成语聊房 + 钻石礼物），用 TikTok 当公域获客与现成变现的"第二根据地"，再把高价值的跨国关系与高 ARPU 变现，通过导流闭环收口回 Telegram Mini App / 自有 App。TikTok 负责"拉新 + 现成变现"，TG/自有负责"沉淀 + 高 ARPU"。**

---

## 1. 双根据地战略定位（TG 与 TikTok 的分工）

| 维度 | Telegram（根据地一） | TikTok（根据地二） |
|---|---|---|
| 载体 | Mini App（满血 web） | Mini Games（H5/Unity/Cocos）+ LIVE 多人连麦 |
| 分发 | 聊天/群裂变（私域强） | **算法推荐（公域冷启最强）** |
| 变现 | Stars + TON（抽成低、可控） | LIVE 钻石 + Mini Games IAP/IAA（现成、抽成高） |
| 关系沉淀 | ✅ 强（账号体系、私聊收口） | 🟡 弱（压外链，靠高光 + 私域收口） |
| 战略角色 | **沉淀 + 高 ARPU 收口** | **公域拉新 + 现成变现入口** |

**为何押 TikTok（而非 FB/IG/X）**：四家里唯一同时给了 ① 嵌入式 App 容器 ② 原生支付/虚拟币 ③ 病毒分发 ④ 现成多人音频房（母文档 §1 能力矩阵）。且 Mini Games 官方定位"跨境全球分发"，**翻译 moat 在 TikTok 上和在 TG 上同样直接生效**——这是它和其余三家的本质区别。

---

## 2. 三条战线总览

```
                    ┌─────────────── TikTok 公域（短视频 + 探索算法）───────────────┐
                    │                                                              │
   战线一 Mini Games│  即点即玩「跨语言狼人杀/问答」→ IAP/IAA 变现 + Growth Max 买量  │
                    │                          │                                   │
   战线二 LIVE 连麦  │  公会主持开「多人连麦房 + LIVE Battle 狼人/问答」→ 钻石礼物     │
                    │                          │                                   │
                    └──────────────────────────┼───────────────────────────────────┘
                                               ▼  战线三：导流闭环
                       高光剪辑 / 战报 / 关系卡 → 私域(TG Mini App / WhatsApp)
                                               ▼
                         沉淀关系 + 高 ARPU 变现（Stars / 翻译特权 / 红娘付费局）
```

---

## 3. 战线一 · TikTok Mini Games 上架路径

> 载荷 = 已有 PRD 的「跨语言狼人杀」+「全球知识问答/你画我猜」。复用 `PRD_跨语言狼人杀.md` 的引擎/AI 主持/翻译流，**新增的是 TikTok 适配层与上架工程**，不是重写。

### 3.1 上架全流程（官方 Dev Portal 路径）

| 步 | 动作 | 关键约束 | 负责 |
|---|---|---|---|
| 1 | 注册 TikTok for Developers，创建 Mini Game 应用 | 需公司主体；US/EU 上线**额外**填 Launch Approval 表（公司运营 + 数据用途） | 法务/PM |
| 2 | 用引擎开发并集成 TikTok 能力（登录/支付/分享/激励广告 SDK） | H5 或 Unity/Cocos 经 **TikTok Minis Adapter** 包装，无需重写游戏逻辑 | 客户端 |
| 3 | 用 **TikTok DevTool** 联调 + 多语言配置 | 多语言是原生支持项（与翻译产品天然契合） | 客户端 |
| 4 | 打包提审 | **zip < 50MB**（快加载硬约束 → 资源瘦身/CDN 分包） | 客户端 |
| 5 | 功能/能力/性能 + 真机多网测试，含**支付链路稳定性** | 用官方测试账号跨设备/网络 | QA |
| 6 | 提交 Dev Portal + **选择上线区域** | 见 §3.4 选区策略 | PM |
| 7 | 过审上线 TikTok Minis → 内容营销 + 付费买量（**Growth Max**） | 分析面板看 retention/playtime/revenue | 增长 |

### 3.2 与狼人杀 PRD 的工程关系（复用 vs 新增）

| 模块 | 复用 PRD | TikTok 新增/改造 |
|---|---|---|
| 游戏引擎/状态机（E2）、AI 主持（E3）、翻译流（E4）、AI 玩家（E6） | ✅ 全复用 | 适配 TikTok 运行时（包体瘦身 < 50MB、首屏加载预算） |
| 登录 | TG initData（E5-4） | **新增 TikTok Login Kit**（抽象统一登录层，双端共用账号体系） |
| 支付 | TG Stars（E8-1） | **新增 TikTok IAP + 激励广告 IAA**（抽象统一计费层） |
| 语音房（E5 WebRTC） | ✅ 复用 LinkU | 验证 TikTok Minis 运行时的实时音频/WebRTC 能力（**关键技术风险，见 §3.5**） |
| 裂变出口（E9） | 分享回 TG | **新增分享回 TikTok 短视频**（高光剪辑做信息流素材） |

> **架构建议**：抽一层「平台适配层」（登录/支付/分享/音频 4 个接口），TG 与 TikTok 各实现一遍，游戏内核保持平台无关 —— 这是双根据地能低成本并行的前提。

### 3.3 变现接法（不破坏对局公平，沿用 PRD §7 原则）
- **IAP**：皮肤/头像框/发言特效/AI 主持音色（只卖外观/身份，不卖战力）。
- **IAA（激励视频，Mini Games 强制高 CPM 位）**：**"看激励广告换实时翻译时长 / 复活观战位 / 额外注解卡"**——把翻译 COGS 用广告对冲（注意：换的是体验/时长，**不发可交易代币**，守红线）。
- **导出口**：高 ARPU（红娘付费局/订阅/深度翻译特权）引导去 TG/自有 App 用 Stars，绕开 TikTok 高抽成。

### 3.4 选区策略（先非美，规避双重风险）
- **首发选区**：巴西 → 沙特/土耳其 → 东南亚（印尼/越/菲/泰/马）。理由：① 母文档锁定的跨语言新兴市场带；② TikTok 在这些区极强；③ **避开美/EU 的额外 Launch Approval 审批 + 美区 TikTok 政策不确定性**。
- **美/EU 后置**：待非美验证跑通、且政策明朗后再补 Launch Approval 表。

### 3.5 风险/红线
| 风险 | 说明 | 对策 | 优先级 |
|---|---|---|---|
| **实时音频能力** | Mini Games 运行时对 WebRTC/实时语音的支持是最大未知 | **M0 先做技术预研 spike**（见 §6 TM0）——若不支持实时多人语音，狼人杀 Mini Game 退化为"异步/文字推理版"或主推 LIVE 形态 | P0 |
| 包体 < 50MB | 狼人杀美术 + 多语言 TTS 资源易超 | 资源 CDN 分包、TTS 走服务端流式、按需加载 | P0 |
| social-casino 定性 | LIVE/小游戏对赌博类强审 | 狼人杀做"社交推理游戏"叙事，无押注/赔率 | P0 |
| 抽成 + 压外链 | 钻石/IAP 抽成高、站外链被压 | 高 ARPU 收口自有（§5）、靠高光素材而非硬链导流 | P1 |
| 审核比 TG 严 | 整号风险 | 内容/AI 披露/年龄门继承 PRD §6 + 母文档红线 | P0 |

---

## 4. 战线二 · TikTok LIVE 多人连麦公会冷启

> LIVE 多人连麦 = **现成的语聊房 + 现成的钻石礼物经济**，无需自建支付。冷启的本质是**供给侧冷启（主持/公会）**，而非产品冷启。

### 4.1 为何走公会（Creator Network / Agency）
单打主播起不来量；TikTok 官方的 **Creator Network（LIVE 公会/Agency）** 提供日常陪跑、流量扶持、变现指导。我们要么**自建公会签主持**，要么**与现有公会合作**，把"跨语言语聊房 + 房内玩法"作为差异化房型注入。

### 4.2 公会准入与机制（官方规则）
| 项 | 规则 | 对我们的含义 |
|---|---|---|
| 主播准入 | **18+、>1000 粉**、需公会邀请码 | 自建公会需先养够种子主播（接 J3 矩阵养号） |
| 公会费用 | **平台不向主播收费**（合规红线：从不收费、可无责退出） | 我们对主播的激励走"分成 + 运营支持"，**不收费、不发代币** |
| 变现 | 礼物 → 钻石 → USD；**Payout 每周三** | 钻石抽成计入单房经济（对照母文档 §3.3 Stars 模型） |
| LIVE 达标门槛 | 单场 ≥25 分钟、需收礼/taps/分享、填满每周一重置的 gift gallery | 排班 SOP 要保证主持时长与互动达标 |

### 4.3 冷启打法
1. **房型差异化**：把 PRD 的玩法搬进 LIVE —— **多人连麦 + LIVE Battle**（可预约、设主题：跨国问答擂台 / 狼人对战），给 MVP 打赏者奖励。这是"语言锁死被翻译解锁"在 LIVE 形态的体现。
2. **AI 兜底 + 主持**：冷场用 AI 暖场主持（母文档/TG玩法 #6），真人公会主持做高光与留存。
3. **跨国对抗叙事**："巴西 vs 印度同房问答/狼人"自带话题，喂 TikTok 算法做短视频二次分发。
4. **签主持 SOP**：J3 矩阵养号 → 满 1000 粉 → 入自建公会 → 排班开"跨语言玩法房" → 钻石分成 + 高光剪辑反哺涨粉。

### 4.4 供给侧红线（沿用母文档 §3/§7）
- ❌ 不用代币/撸毛诱导主播或用户（拉雇佣兵、毁留存、合规雷）。
- ❌ 不做"付费给女生发币换上麦/点赞"式供给造假（母文档明确红线）。
- ❌ 不擦边（LIVE 礼物违规=整号/整公会被封）。
- ✅ 供给侧用"公会运营 + 分成 + AI 兜底"，关系沉淀收口自有账号。

---

## 5. 战线三 · 双根据地导流闭环（TikTok ↔ TG ↔ 自有 App）

> 核心命题：**TikTok 拉新强但留不住关系（压外链）；TG/自有沉淀强。闭环就是把 TikTok 的公域流量，经"高光素材"漏到私域沉淀，再回流喂 TikTok 算法。**

### 5.1 三个闭环

**闭环 A · 公域获客环（TikTok 内循环，喂算法）**
```
短视频/LIVE 高光（跨国狼人翻车/问答夺冠/CP 名场面）
   → 涨粉 + 进 Mini Game / LIVE 房 → 产生新高光 → 再投短视频
```
J5 爆款内容 + 跨国对抗天然话题，做信息流素材飞轮。

**闭环 B · 私域沉淀环（TikTok → 私域，收口关系/高 ARPU）**
```
TikTok 房内聊嗨 → 战报/关系卡/"有个 X 国的人想和你聊"H5
   → 引导加 TG（Mini App）/ WhatsApp（召回）
   → 高 ARPU 变现（Stars 礼物 / 翻译特权 / 红娘付费局 / 订阅）
```
压外链对策见 §5.3。

**闭环 C · 双载体账号/资产打通（TG Mini App ↔ TikTok Mini Game）**
```
统一账号体系（平台适配层）→ 同一用户在 TG 与 TikTok 共享：
   好友关系 / 关系卡 / 皮肤资产 / 段位 / 翻译时长
   → 任一端拉新都喂同一资产池，降低跨端流失
```

### 5.2 流量地图（角色分工）
| 渠道 | 角色 | 接法 |
|---|---|---|
| TikTok 短视频/探索 | 公域拉新主力 | J5 爆款 + 高光剪辑 |
| TikTok Mini Game / LIVE | 体验 + 现成变现 | 战线一/二 |
| Instagram / Facebook | 辅助获客 | J3 矩阵 + 评论转私信（已有方案）→ 导去 TG/TikTok |
| **Telegram Mini App** | **关系沉淀 + 高 ARPU 收口** | Stars / 红娘局 / 订阅 |
| WhatsApp | 私域召回 CRM | "今晚有跨语言狼人局"模板消息（opt-in，巴西可叠支付） |
| X | 免费音频顶漏斗 | Spaces 直播破冰 + 对外链落地页 |

### 5.3 压外链对策（TikTok/IG 抑制站外链）
- 不靠硬链：用**高光素材 + 悬念钩子**（"完整剧情在简介/置顶")+ **评论转私信**（复用 IG comment-to-DM 方案，迁移到 TikTok）。
- 主页/置顶位放唯一可信落地页（H5），落地页再分发到 TG Mini App / 自有 App。
- 私域承接：WhatsApp/TG 做召回，绕开公域压制。

### 5.4 跨平台归因
- 统一 deeplink + UTM/渠道码，打通 "TikTok 曝光 → 落地页 → TG/自有进房 → 变现" 全漏斗。
- 关系卡/战报带来源标记，识别哪条高光带来高价值用户。

---

## 6. 里程碑（建议排期）

| 里程碑 | 目标 | 包含 | 验收 |
|---|---|---|---|
| **TM0 技术预研**（spike，先做） | 验证 TikTok Mini Games 运行时是否支持实时多人语音 | TG1-1 音频能力 spike、TG1-2 平台适配层设计 | 给出"实时语音可行/降级方案"结论（决定狼人杀 Mini Game 形态） |
| **TM1 LIVE 先跑**（最快现成变现） | 不依赖 Mini Game 工程，先用现成 LIVE 验证供给与变现 | TG2-*（公会 + 多人连麦房型 + LIVE Battle + AI 兜底） | 自建公会签 ≥N 主持、跑通"跨语言玩法房 + 钻石变现" |
| **TM2 Mini Game 上架**（公域拉新载体） | 狼人杀/问答 Mini Game 非美区上线 | TG1-*（适配层 + IAP/IAA + 上架 + Growth Max）、复用 PRD M2 | 巴西等区过审上线、IAP/IAA 闭环、算法分发起量 |
| **TM3 闭环打通**（沉淀 + 高 ARPU） | 三个导流闭环 + 双载体账号打通 | TG3-*（高光飞轮 + 私域召回 + 账号/资产打通 + 归因） | TikTok→TG 导流漏斗可统计、跨端资产共享 |
| **TM4 规模化** | 矩阵 + 多区 + 美/EU | 多公会、Growth Max 规模买量、美/EU Launch Approval | ROI 可控、多区复制 |

> **排期次序的关键判断**：**TM1（LIVE）先于 TM2（Mini Game）** —— LIVE 是现成载体、零上架工程、能最快验证"跨语言玩法 + 钻石变现"的市场反应；Mini Game 工程更重且卡在 TM0 音频预研结论上。

---

## 7. 可排期需求列表（Backlog）

> 优先级 P0/P1/P2；估算 S≈1–2 人日，M≈3–5 人日，L≈1–2 人周，XL≈>2 人周。

### TG1 Mini Games 工程与上架
| ID | 需求 | P | 估 | 依赖 | 验收 |
|---|---|---|---|---|---|
| TG1-1 | **音频能力 spike**：验证 Minis 运行时实时多人语音/WebRTC | P0 | M | — | 出可行性结论 + 降级方案 |
| TG1-2 | 平台适配层（登录/支付/分享/音频 4 接口抽象） | P0 | L | TG1-1 | TG/TikTok 双实现、内核平台无关 |
| TG1-3 | TikTok Login Kit 接入 | P0 | M | TG1-2 | 免注册进游戏 |
| TG1-4 | TikTok IAP + 激励广告 IAA 接入 | P0 | L | TG1-2 | 道具购买 + 看广告换翻译时长闭环 |
| TG1-5 | 包体瘦身 < 50MB（资源分包/CDN/TTS 服务端流式） | P0 | M | PRD E4 | 首屏加载达标、过审 |
| TG1-6 | DevTool 联调 + 多语言配置 | P0 | M | TG1-3/4 | 多语言正确 |
| TG1-7 | 提审 + 非美选区上线（巴西首发） | P0 | M | 全部 | 过审上线 |
| TG1-8 | Growth Max 买量接入 + 分析面板 | P1 | M | TG1-7 | retention/playtime/revenue 可观测 |
| TG1-9 | 美/EU Launch Approval 表 + 上线 | P2 | M | 法务 | 后置 |

### TG2 LIVE 公会与房型
| ID | 需求 | P | 估 | 依赖 | 验收 |
|---|---|---|---|---|---|
| TG2-1 | 自建公会（Creator Network）+ 主播招募/邀请码 SOP | P0 | M | J3 | 签 ≥N 个 18+/1000 粉主持 |
| TG2-2 | 跨语言"多人连麦"房型脚本 + 排班达标 SOP（≥25min/互动） | P0 | M | TG2-1 | 房稳定开播、达标领 payout |
| TG2-3 | LIVE Battle 跑跨国问答/狼人对战（主题 + MVP 奖励） | P1 | M | TG2-2 | 对战可预约、有话题素材 |
| TG2-4 | AI 暖场兜底（接 PRD AI 主持/AI 玩家） | P1 | M | PRD E3/E6 | 冷场不冷 |
| TG2-5 | 主播分成与运营激励（非代币、不收费） | P0 | S | 法务 | 合规分成机制 |

### TG3 导流闭环与归因
| ID | 需求 | P | 估 | 依赖 | 验收 |
|---|---|---|---|---|---|
| TG3-1 | 高光剪辑生成（狼人翻车/问答夺冠/CP）→ 短视频素材 | P1 | L | PRD E9-3 | 可生成可投放 |
| TG3-2 | 评论转私信导流（复用 IG 方案迁 TikTok） | P1 | M | 已有方案 | 评论钩子→私信→落地页 |
| TG3-3 | 落地页 H5（"有个 X 国的人想和你聊"）+ 分发 TG/自有 | P1 | M | — | 唯一可信外链入口 |
| TG3-4 | 双载体账号/资产打通（关系卡/皮肤/段位/翻译时长共享） | P1 | L | TG1-2 | 跨端同账号同资产 |
| TG3-5 | WhatsApp 召回（模板消息，opt-in；巴西叠支付） | P2 | M | 合规 | 召回闭环 |
| TG3-6 | 跨平台 deeplink + UTM 全漏斗归因 | P1 | M | TG3-3 | 漏斗可统计 |

---

## 8. 待决策项（评审拍板）

1. **TM0 音频预研结论**：Mini Games 运行时若不支持实时多人语音，狼人杀 Mini Game 走"异步/文字推理版"还是只在 LIVE 形态做？**决定战线一形态，关键决策。**
2. **排期次序**：是否确认 **LIVE（TM1）先于 Mini Game（TM2）**（推荐是，现成变现最快验证）。
3. **公会模式**：自建公会 vs 合作现有公会（影响供给冷启速度与抽成）。
4. **首发区**：巴西单点突破 vs 巴西+中东并行（影响资源）。
5. **抽成下变现结构**：哪些变现留在 TikTok（拉新/低 ARPU），哪些强制收口 TG（高 ARPU），需定清单。
6. **AI 披露口径在 TikTok 的合规**：沿用 PRD 房间级披露 + 赛后揭示，是否满足 TikTok 审核（法务确认）。

---

## 9. 关键指标

| 类型 | 指标 | 说明 |
|---|---|---|
| 北极星 | TikTok 渠道带来的**完成跨语言对局 / LIVE 时长** | 与 PRD 北极星对齐 |
| 获客 | Mini Game 安装/进房成本、LIVE 涨粉、短视频→进房转化 | Growth Max ROI |
| 变现 | IAP 付费率/ARPPU、IAA eCPM、LIVE 钻石 GMV | 现成变现底盘 |
| 闭环 | **TikTok→TG/自有 导流率**、跨端账号打通率、私域召回率 | 战线三核心 |
| 留存 | Mini Game 次留/playtime、LIVE 主播留存与房复访 | — |
| 风控 | 封号率、内容违规率、抽成后单房净经济 | 守红线 |

---

## 10. 收束

> **TikTok 第二根据地的最短可信路径 = 先用现成的 LIVE 多人连麦（TM1，零上架工程）验证"跨语言玩法 + 钻石变现"的市场反应；同时做 TM0 音频预研，决定狼人杀 Mini Game 的形态再上 TM2 吃算法分发与 IAP/IAA；最后用导流闭环（TM3）把 TikTok 的公域流量收口回 Telegram/自有 App 沉淀关系与高 ARPU。一句话：TikTok 管"拉新 + 现成变现"，TG/自有管"沉淀 + 高 ARPU"，翻译 moat 是两个根据地共同的护城河。**

---

## 附：信息来源（2025–2026 核实）

- Mini Games 开发/提审/选区/能力：[developers.tiktok.com — Mini Games Overview](https://developers.tiktok.com/doc/mini-games-overview)、[Develop Your Mini Game](https://developers.tiktok.com/doc/develop-your-mini-game)、[US & EU Launch Approval](https://developers.tiktok.com/doc/launch-your-app-to-us-users-minigames)、[App Review Guidelines](https://developers.tiktok.com/doc/app-review-guidelines)
- Mini Games 变现/买量：[TikTok For Business — Growth Max for Mini Games](https://ads.tiktok.com/business/en-US/blog/tiktok-growth-max-mini-games)、[ipfoxy — Monetize TikTok Minis 2026](https://www.ipfoxy.com/blog/ideas-inspiration/5684)
- LIVE 多人连麦/礼物/订阅/Battle/payout：[TikTok LIVE Monetization Guidelines](https://www.tiktok.com/live/creators/en-US/rules_and_guidance/live_monetization_guidelines)、[calculatecreator — TikTok LIVE Monetization 2025](https://calculatecreator.com/guides/tiktok-live/)
- LIVE 公会/Creator Network 准入（18+/1000 粉/邀请码/不收费）：[TikTok — How to Join a LIVE Agency](https://www.tiktok.com/discover/how-to-join-an-agency-tiktok-live)、[Creator Network 101](https://www.tiktok.com/@tiktoklive_us/video/7289160364321819946)
