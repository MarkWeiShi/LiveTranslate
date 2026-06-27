# 抖音 / 小红书 / B站 Comment-to-DM 与评论区互动 合规方案与技术步骤

> 本文档只保留**技术可行且官方合规**的路线，灰产/逆向/群控方案一律不纳入。改写自原 Instagram 方案——IG 可用官方 OAuth + Graph API 直接对评论者私信（Private Reply），国内三平台**无此等价能力**，因此本文按"各平台官方真实能力"重新组织，并细化每条路线的落地技术步骤。

---

## 一、结论与适用范围

**核心原则：国内三平台没有"主动群发私信"的合规能力。** 合规的 comment-to-DM 只有两种形态：

- **引导式**（抖音）：评论关键词 → 公开回复引导 → 用户点私信卡片/开口 → 私信自动回复。
- **意向评论触达**（小红书）：系统自动抓取**本人笔记**下的意向评论 → 自动私信留资。

可行路线优先级：**小红书 ≈ 抖音 ＞ B站**。B站官方无评论/私信自动化 API，仅有"被动私信关键词回复"，**不做矩阵自动化**。

| 能力 | 抖音 | 小红书 | B站 |
|---|---|---|---|
| 评论关键词自动回复（公开） | ✅ 后台 + 开放平台 API | ❌ 官方无 | ❌ 官方无 |
| 评论 → 私信（comment-to-DM） | ✅ 引导式 | ✅ 意向评论触达（限本人笔记） | ❌ 无 |
| 私信关键词自动回复 | ✅ | ✅ | ✅ 需≥1000 粉、被动 |
| 客资线索回流 CRM（API） | △ 私信被动回复 API | ✅ 聚光客资 webhook（只收） | ❌ |
| 多账号集中 | 逐号 OAuth + SCRM | 私信通多客服后台 | 不适用 |

---

## 二、抖音 —— 技术步骤

合规闭环：**评论事件 → 关键词匹配 → 公开回复引导 → 用户点私信卡片/开口 → 私信关键词自动回复（48h 窗口内可程序化回复）**。

### 步骤 0｜前置资质
1. 完成**企业认证（蓝V）**（约 600 元/年）。
2. 注册[抖音开放平台](https://open.douyin.com/)开发者（企业主体），创建"网站应用/移动应用"。
3. 在「应用管理 → 接口权限」申请：`item.comment`（视频评论管理）、私信相关权限（`im.message`，仅认证企业号开放）。等待审核。

### 步骤 1｜OAuth 授权拿 access_token（逐号扫码）
每个矩阵号需单独扫码授权一次。授权码换 token：

```text
// 1) 前端引导用户扫码授权,拿到 code(scope=item.comment,im.message)
//    https://open.douyin.com/platform/oauth/connect/?client_key=...&scope=...&response_type=code&redirect_uri=...

// 2) code → access_token(有效期 15 天)+ refresh_token(有效期 30 天)+ open_id
POST https://open.douyin.com/oauth/access_token/
  { client_key, client_secret, code, grant_type: 'authorization_code' }
  // 返回: { access_token, refresh_token, open_id, expires_in, scope }

// 3) AES-256-GCM 加密 access_token / refresh_token 入库,记录 open_id 与 expires_at
```

**Token 续期（必须做定时任务）**：access_token 15 天过期，用 refresh_token 刷新；refresh_token 30 天过期，到期前用 `renew_refresh_token` 续期，否则需用户重新扫码。建议每天扫描临期 token 自动刷新。

### 步骤 2｜评论监听（二选一）

**方式 A（推荐）：事件订阅 / Webhook 实时推送**
1. 开放平台「管理中心 → Webhooks」启用，填手机验证码获取**验签秘钥**，配置回调地址。
2. 平台首次保存会 POST 一个验证请求，需解析出 `challenge` 并原样以 text/json 放进 ResponseBody 返回。
3. 在管理中心订阅「视频评论」「企业号私信」事件。
4. 收到推送后验签 —— 取 header `X-Douyin-Signature`，本地计算 `sha1(client_secret + rawBody)` 比对；用 header `Msg-Id` 去重；处理超时 5s（重试 3 次），故**只验签 → 入队 → 立即 200**。

```text
// Webhook 承接
const expected = sha1(CLIENT_SECRET + rawBody);
if (req.headers['x-douyin-signature'] !== expected) return res.status(401);
if (await seen(req.headers['msg-id'])) return res.send('ok');      // 去重
await queue.add('comment', JSON.parse(rawBody));                   // 入队
return res.send('ok');                                             // 立即返回
```

**方式 B：轮询评论列表**（无 Webhook 时兜底）

```text
GET https://open.douyin.com/item/comment/list/   // 取视频评论
  { access_token, item_id, cursor, count }
```

### 步骤 3｜评论区公开自动回复（引导进私信）

```text
POST https://open.douyin.com/item/comment/reply/
  { access_token, item_id, comment_id, content }   // content 含引导语 + Spintax 防雷同
// 可选置顶: POST https://open.douyin.com/item/comment/top/  (企业号)
```

同时在企业号后台配置「**评论关键词自动回复**」作为无代码兜底，并在视频/主页挂「**私信卡片 / 小风车 / 留资卡**」作为进私信入口。

### 步骤 4｜私信自动回复（comment-to-DM 的"DM"侧）
**抖音私信是被动制**：用户点私信卡片/主动开口后，48h 窗口内企业号可回复（≤3 条，自动回复 1 条不计）。两条路：

- **无代码**：企业号后台「**私信关键词自动回复**」——预设触发词，回文本/图片/链接/消息卡片/问题列表/留资卡。覆盖绝大多数场景，**优先用这个**。
- **程序化**：收到「企业号私信」事件后，调发送私信接口在窗口内回复并发留资卡：

```text
POST https://open.douyin.com/api/im/message/send/      // 私信发送(认证企业号)
  { access_token, to_user_id, message_type, content }
// 受 48h 会话窗口 + 频次限制(非互关主动:每小时≤40人/每天≤100人/同一人≤3条)
```

### 步骤 5｜多账号集中
开放平台按号 OAuth，集中编排靠你的中台；**官方后台不支持上百号统一管理**，规模化时用第三方 SCRM（飞鱼/客服系统）扫码聚合各企业号授权，统一收口客资。

---

## 三、小红书 —— 技术步骤

合规闭环：**后台配置 AI 自动承接（意向评论触达 + 智能私信助手）→ 聚光客资 webhook 把线索 POST 给自有 CRM**。小红书的自动化主要在**后台/AI 工具**，对外只有"客资 webhook（只收不发）"。

### 步骤 0｜前置资质
1. 开通**企业号/专业号**（营业执照 + 对公账户；个人号不能开聚光）。
2. 开通**聚光**广告账户。门槛：私信组件一般月耗≥1000 元；「意向评论触达」进阶模块需企业号近 30 天聚光"客资收集"消耗 >3000 元。

### 步骤 1｜后台配置 comment-to-DM（无代码）
1. **意向评论触达 / AI 小助手**：开启后系统自动抓取**本人笔记**下的求购/意向评论 → 自动私信该用户（AI 生成或固定话术）→ 自动发名片/留资卡；对"已开口未留资"用户自动追问唤活。该消息不占每日陌生人私信上限。
2. **智能私信助手（关键词回复）**：配置欢迎语 + 关键词回复，回文本/服务留资卡/企微·个微名片。
3. 话术内**不得**出现微信号/二维码/外链，导流只走站内留资卡/名片组件，否则被屏蔽。

> 注意：小红书**只能承接自己笔记的评论**，无法去他人/对标笔记评论区截流。

### 步骤 2｜聚光客资线索 API（webhook）回流 CRM
把已归因的私信线索（昵称、联系方式、地域、计划/单元/创意 ID）实时同步进自有 CRM：

1. 聚光平台「**工具 → 私信 API 对接**」，在表单配置「数据推送」，生成 **Token**。
2. 把 Token 配到 CRM；把 CRM 的「post 消息接收地址」填回聚光，点「发送测试消息」联调。
3. 你的接收端实现：

```text
// 接收聚光线索推送
POST <你的接收地址>   Content-Type: application/json
// 验签: 取 header X-Red-Signature, 用 request body + Token 本地生成签名比对
const ok = verify(req.headers['x-red-signature'], rawBody, TOKEN);
if (!ok) return res.status(401);
await crm.upsertLead(JSON.parse(rawBody));   // 落库
return res.status(200);                        // 必须 200,否则每 30s 重试,最多 3 次
```

### 步骤 3｜多账号集中
私信通后台支持**多账号 + 多客服坐席**（一个专业号约 200 坐席，Web/桌面/移动多端），但是**人工 operate，无私信自动化开放 API**。规模化靠坐席分流 + AI 自动承接，统一客资走聚光 webhook 进 CRM。

---

## 四、B站 —— 技术步骤

**官方无评论/私信自动化 API，亦无评论关键词自动回复。唯一合规自动化是"被动私信关键词回复"。**

### 唯一合规路线（无代码）
1. 账号养至 **≥1000 粉**（开通门槛）。
2. 创作中心/后台开启「**私信关键词自动回复 / 被关注自动回复**」：精确或模糊匹配，≤20 条规则，回文本。**被动触发**（用户先私信你才生效）。
3. 简介/置顶放合规蓝链引导；商业推广走**花火**平台报备。

**不做**：评论区自动回评、私信群发、矩阵号自动化——B站官方均无此能力，且机制上未互关时陌生人仅能发 1 条私信，批量私信不成立。

---

## 五、统一中台架构（精简）

工程重心放在"合规承接 + 客资 CRM"，不做主动私信引擎。

```text
            ┌──────────────────────────────────────────────┐
            │        统一运营中台 (复用现有 Node/云)          │
            │  话术库/Spintax · 关键词规则 · 客资CRM(MySQL)   │
            │  去重(Redis 24h) · 限速 · 审计落库 · 数据看板   │
            └───────┬───────────────┬───────────────┬───────┘
                    │               │               │
            ┌───────▼──────┐ ┌──────▼───────┐ ┌─────▼──────┐
            │   抖音适配     │ │  小红书适配    │ │  B站适配    │
            │ OAuth逐号      │ │ 后台AI承接     │ │ 后台私信    │
            │ 评论Webhook    │ │ (意向评论触达) │ │ 关键词回复  │
            │ 评论回复API    │ │ 聚光客资webhook│ │ (被动,无API)│
            │ 私信关键词回复 │ │  → CRM        │ │ 商单走花火  │
            │ +第三方SCRM    │ │ 多客服后台     │ │            │
            └──────────────┘ └──────────────┘ └────────────┘
```

**可复用的通用工程（仅用于"用户开口后的承接"，非主动群发）**：
- **客资 CRM / 审计落库（MySQL）**：统一收口三平台线索，做归因与转化分析。
- **关键词规则引擎 + 去重（Redis 24h）+ 限速**：触发控制、同一用户去重、各号频次安全余量。
- **话术库 + Spintax 随机池**：避免多号雷同被判工业化营销。
- **加密令牌库（AES-256-GCM）+ OAuth state 防 CSRF**：存抖音逐号授权态，定时刷新临期 token。

---

## 六、合规红线（必须遵守）

1. **只做被动承接 / 引导式**，绝不主动群发私信。
2. **尊重私信硬频次**：抖音非互关每小时≤40 / 每天≤100 人、48h 窗口≤3 条；小红书每日陌生人≈20 条；B站陌生人 1 条。
3. **导流只走站内组件**（私信卡片 / 服务留资卡 / 企微·个微名片 / 私信快捷菜单），**禁止**私信/评论直接发微信号、二维码、外链。
4. **话术差异化**（Spintax + 卡片差异化），避免百号同质内容。
5. **矩阵规模克制**：三平台均对"矩阵号相互引流"做连坐处置；账号隔离 + 控制矩阵规模，第三方 SCRM 授权前过法务。

---

## 附录：关键接口与文档来源

**抖音**
- 获取 access_token / 刷新：https://developer.open-douyin.com/docs/resource/zh-CN/dop/develop/openapi/account-permission/get-access-token
- Webhook 接入与验签（X-Douyin-Signature / challenge / Msg-Id）：https://partner.open-douyin.com/docs/resource/zh-CN/dop/develop/webhooks/summarize
- 视频评论管理（列表/回复/置顶）：https://developer.open-douyin.com/capacity-center-page/capacity-detail/7180530418775490619
- 发送私信（认证企业号）：https://developer.open-douyin.com/docs/resource/zh-CN/dop/develop/openapi/interaction-management/private-message/send-msg
- 企业号私信规则（窗口/频次）：https://renzheng.douyin.com/support/content/126811

**小红书**
- 私信通：https://sxt.xiaohongshu.com/ ｜ 意向评论触达 / AI 小助手：https://www.xiao-ad.com/zx/2531.html
- 聚光私信客资 API 对接（工具→私信API对接 / X-Red-Signature / 200 ack / 重试）：https://www.juxuan.net/22581.html
- 聚光导流合规（留资卡/名片）：https://ad.xiaohongshu.com/help/docs?id=2685

**B站**
- 开放平台文档：https://openhome.bilibili.com/doc ｜ 私信关键词自动回复（创作中心后台功能，需≥1000 粉）
- 用户协议：https://www.bilibili.com/protocal/licence.html

> 提示：各平台开发者文档多为登录态 JS 渲染，权限白名单、接口路径与频次数字会不定期调整，接入前请登录对应后台/开放平台核对最新口径。
