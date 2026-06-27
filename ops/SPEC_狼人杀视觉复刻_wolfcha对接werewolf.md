# 视觉复刻 SPEC · wolfcha → werewolf.tsx 对接

> 参考源：[oil-oil/wolfcha](https://github.com/oil-oil/wolfcha)（Apache-2.0，Next.js 16 + Tailwind4 + **Framer Motion** + DiceBear）
> 目标：把 wolfcha 的视觉/动效精髓，移植进我们的 **Expo / RN-web** 狼人杀（`werewolf.tsx`），并将狼人杀设为**登录后核心玩法（首页 tab）**。
> 关联：`PRD_跨语言狼人杀.md`、`Telegram玩法_语聊房可借鉴机制清单.md`
> 日期：2026-06-27

---

## 0. 实现策略与一处关键取舍（务必先读）

- wolfcha 用 **Framer Motion**（web-only）。我们是 **Expo/RN-web**，**首选目标 = Moti（底层 Reanimated）**，因为它跨 web/native 且 API 与 Framer Motion 几乎一一对应。
- **本次落地实现用 React Native 内置 `Animated`**（零新依赖、零 babel 改动、**保证 H5 export 与 gate 绿灯**、Telegram 现网不挂）。RN `Animated` 正是 Reanimated 的"安全子集"，本 SPEC 的动效全部用它实现。
- **下表第 4 节同时给出 Moti/Reanimated 目标写法**——想升级到弹簧/更顺滑动效时，按"迁移指南"（§6）加 `moti` + `react-native-reanimated` 即可平移，组件结构不变。
- **lip-sync 头像不依赖任何动效库**：本质是定时切换 DiceBear 图片 URL（`setInterval` + `<Image>`），跨端零风险——这是性价比最高、最像 wolfcha 的一招。

---

## 1. 设计 Token（从 wolfcha `globals.css` 提取，已并入 `theme.ts: wolf`）

**双主题：羊皮纸白天 / 血色暗夜。**

| 用途 | 变量 | 值 |
|---|---|---|
| 白天主底 | `bg-day-main` | `#f5f0e6` |
| 白天渐变 from/via/to | | `#fdfbf7` / `#f2ebe0` / `#e6ded1` |
| 暗夜主底 | `bg-dark` | `#1a1614` |
| 暗夜次底 | `bg-dark-secondary` | `#2c241b` |
| 血红（狼/强调） | `blood` | `#8a1c1c`（亮 `#b93636`） |
| 金（点缀/警徽） | `gold/accent` | `#c5a059` |
| 角色色 · 狼 | `wolf` | `#8a1c1c` |
| 角色色 · 预言家 | `seer` | `#2c5282`（夜 `#4a90e2`） |
| 角色色 · 女巫 | `witch` | `#6b46c1` |
| 角色色 · 猎人 | `hunter` | `#c05621` |
| 角色色 · 守卫 | `guard` | `#276749` |
| 角色色 · 平民 | `villager` | `#5c4a3d` |
| 成功/警告 | `success/warning` | `#2f855a` / `#c05621` |

> 角色卡背景统一用对应色的 12–15% 透明叠加（`-bg` 变量）。夜晚在底色上叠 `radial-gradient(血红 5%)` + 噪点。

---

## 2. wolfcha 组件 → 我们组件 映射清单

| wolfcha 组件 | 作用 | 我们对应（Expo/RN-web） | 优先级 |
|---|---|---|---|
| `GameBackground.tsx` | 昼夜底色交叉淡入 + 血红光晕脉动 + 角纹 | **`WolfBackground.tsx`**（已建） | P0 |
| `TalkingAvatar.tsx` | DiceBear 头像 + 120ms 换嘴型 lip-sync | **`LipSyncAvatar.tsx`**（已建） | P0 |
| `RoleRevealOverlay.tsx` | 翻牌发牌 + 角色能力/提示卡 | **`RoleRevealCard.tsx`**（已建） | P0 |
| `PlayerCardCompact.tsx` | 座位卡：发言光环/死亡脉冲/出局去色/翻身入场 | werewolf 座位网格（内联升级） | P0 |
| `NightActionOverlay.tsx` | 狼爪/解药光环/毒雾/猎人爆裂/预言家眼 全屏特效 | `NightFx.tsx`（P1，先做狼爪+解药+预言家眼） | P1 |
| `DialogArea.tsx` + `useTypewriter` | 发言逐字打字机 | 字幕流逐字（P1，可选） | P1 |
| `VoteResultCard.tsx` / `VotingProgress.tsx` | 投票进度/结果动画 | 投票面板升级 | P1 |
| `WelcomeScreen.tsx` | 入场欢迎/开局 | 大厅美化 | P2 |
| `icons/FlatIcons.tsx` | 角色扁平图标 | emoji/自绘图标（先 emoji） | P2 |

---

## 3. wolfcha 关键动效拆解（实测参数）

| 动效 | wolfcha 实现（Framer Motion / CSS） | 参数 |
|---|---|---|
| **昼夜交叉淡入** | 两层 `motion.div` `animate={{opacity}}` | duration **1.5s**（眨眼瞬切时 0s） |
| **暗夜雾气脉动** | `animate={{scale:[1,1.05,1]}}` | duration **10s** loop easeInOut |
| **血红光晕呼吸** | `blur(100px)` 圆 + `animate-pulse` | CSS pulse |
| **发牌翻牌** | `animate={{rotateY: revealed?0:180}}` `preserve-3d` | **0.7s** easeInOut，延迟 **650ms** 翻 |
| **角色卡入场** | `from{y:14,scale:.98,opacity:0}` spring | **stiffness 420 / damping 34** |
| **卡面待机浮动** | `animate={{rotate:[0,4,-4,0],scale:[1,1.02,1]}}` | **3.6s** loop easeInOut |
| **lip-sync** | `setInterval` 切 `lips=variant04/11` | 每 **120ms** |
| **发言光环** | 座位卡 `isSpeaking` 边框高亮 + 脉冲 | — |
| **死亡** | `deathPulse` 900ms + 头像去色（grayscale） | **900ms** |
| **就绪弹出** | `revealPop` scale 弹一下 | **600ms** |
| **夜间特效** | 狼爪 path 划过 / 解药同心圆扩散 / 毒雾扭曲 / 猎人放射线 / 预言家眼 | CSS keyframes |

---

## 4. 动效映射：Framer Motion → Moti/Reanimated → 我们落地用的 RN Animated

> 左=wolfcha 原写法；中=**推荐目标 Moti**；右=**本次实际落地 RN Animated**。

### 4.1 昼夜交叉淡入
```tsx
// wolfcha (Framer Motion)
<motion.div animate={{opacity:isNight?1:0}} transition={{duration:1.5}}/>

// 目标 Moti
<MotiView animate={{opacity:isNight?1:0}} transition={{type:'timing',duration:1500}}/>

// 落地 RN Animated（见 WolfBackground.tsx）
Animated.timing(op,{toValue:isNight?1:0,duration:1500,useNativeDriver:true}).start()
<Animated.View style={{opacity:op}}/>
```

### 4.2 循环脉动（雾气/光晕）
```tsx
// Moti：loop + repeatReverse
<MotiView from={{scale:1}} animate={{scale:1.05}}
  transition={{loop:true, repeatReverse:true, duration:5000, type:'timing'}}/>

// RN Animated：Animated.loop(sequence)
Animated.loop(Animated.sequence([
  Animated.timing(s,{toValue:1.05,duration:5000,useNativeDriver:true}),
  Animated.timing(s,{toValue:1,duration:5000,useNativeDriver:true}),
])).start()
```

### 4.3 发牌翻牌（rotateY 3D）
```tsx
// Moti
<MotiView animate={{rotateY: revealed?'0deg':'180deg'}}
  transition={{type:'timing',duration:700}} style={{backfaceVisibility:'hidden'}}/>

// RN Animated（interpolate 角度）
const spin = rot.interpolate({inputRange:[0,1],outputRange:['180deg','0deg']});
<Animated.View style={{transform:[{perspective:1200},{rotateY:spin}]}}/>
// 注：RN-web 支持 rotateY + perspective；backfaceVisibility:'hidden' 双面切换
```

### 4.4 弹簧入场
```tsx
// Moti
<MotiView from={{opacity:0,translateY:14,scale:.98}}
  animate={{opacity:1,translateY:0,scale:1}}
  transition={{type:'spring',stiffness:420,damping:34}}/>

// RN Animated：Animated.spring
Animated.spring(v,{toValue:1,stiffness:420,damping:34,useNativeDriver:true}).start()
```

### 4.5 lip-sync（无需动效库，跨端一致）
```tsx
// 两端相同：定时切换 DiceBear lips 参数的图片 URL
useEffect(()=>{ if(!talking){setLips(idle);return;}
  let i=0; const id=setInterval(()=>{i=(i+1)%TALK.length; setLips(TALK[i]);},120);
  return ()=>clearInterval(id);
},[talking]);
<Image source={{uri: dicebear(seed,{lips})}}/>
```

### 4.6 死亡去色
```tsx
// web: filter:grayscale(1)（RN-web 支持 style.filter 字符串）
// 落地：出局座位叠半透明黑 + opacity 0.4 + 💀；web 额外可加 filter grayscale
```

---

## 5. DiceBear 头像规则（从 `avatar-config.ts` 移植）

- API：`https://api.dicebear.com/7.x/notionists/svg?seed=<x>&...`（免费、免鉴权、HTTP 直出，RN-web `<Image>` 直接用 SVG）。
- 关键参数：`seed`（人物指纹）、`lips=variantNN`（嘴型，**lip-sync 的核心**）、`eyes`、`hair`、`backgroundColor`、`scale`、`translateY`、`beardProbability=0`。
- 嘴型集合：全 30 个 `variant01..30`；**说话用 `variant04`/`variant11` 交替**；静止用其余（排除 `01/02/05`）。
- 座位头像 `seed` 用 `userId`（真人）或 `Bot-N`（AI），保证稳定。
- ⚠️ 性能：每个头像把"静止 + 说话两套"URL 预拉一次（`new Image()`），避免切嘴闪烁。

---

## 6. 迁移到 Moti（可选升级，想要弹簧/更顺时再做）

```bash
npm -w app i moti react-native-reanimated
```
`app/babel.config.js` 加插件（必须在最后）：
```js
module.exports = (api)=>{api.cache(true);return{
  presets:['babel-preset-expo'],
  plugins:['react-native-reanimated/plugin'],
};};
```
然后把 `Animated.View` 换成 `MotiView`、按 §4 中列写 `from/animate/transition`。
> ⚠️ 升级后**必须重跑 `npm -w app run export:web` 验证 H5 仍可构建**（Reanimated web 偶有坑）；过了再进 gate。本次为保现网稳定**暂不引入**。

---

## 7. 落地组件清单（本次已实现）

| 文件 | 内容 |
|---|---|
| `app/src/theme.ts` | 新增 `wolf` 调色板 token（§1） |
| `app/src/game/avatar.ts` | DiceBear URL 构造（§5） |
| `app/src/components/werewolf/WolfBackground.tsx` | 昼夜交叉淡入 + 血红呼吸光晕（RN Animated） |
| `app/src/components/werewolf/LipSyncAvatar.tsx` | DiceBear lip-sync 头像 |
| `app/src/components/werewolf/RoleRevealCard.tsx` | 翻牌发牌 + 角色卡入场（RN Animated） |
| `app/src/screens/WerewolfGame.tsx` | 升级后的狼人杀主屏（昼夜底/座位网格/发言高亮/角色卡/夜间提示/投票/结算） |
| `app/app/(tabs)/index.tsx` | **首页 tab = 狼人杀**（渲染 WerewolfGame） |
| `app/app/(tabs)/discover.tsx` | 原"发现"迁此 |
| `app/app/(tabs)/_layout.tsx` | tab 顺序：🐺狼人杀 / 🌍发现 / 💬好友 / 🕘记录 / 👤我的 |

---

## 8. 验收

- `npm run typecheck` 全过；`npm -w app run export:web` H5 构建过；`./gate.sh` 绿。
- 视觉：进房昼夜底随阶段切换；座位头像发言时口型动；发牌有翻牌动画；发言高亮当前麦位；出局去色。
- 玩法不回退：仍跑通 `smoke-werewolf`（8/8）。
- 登录后默认落在 🐺 狼人杀 tab。
