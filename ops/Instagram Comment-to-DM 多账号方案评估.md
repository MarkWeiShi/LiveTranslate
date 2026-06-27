# Instagram Comment\-to\-DM 多账号方案评估

## 一、可行性结论

**✅ 方案可行**

采用官方 **OAuth 授权 方案,可稳定实现几十至上百个 Instagram 账号的 Comment\-to\-DM**

**前提是账号需先完成 Creator / Business 专业号认证\(免费、即时、无粉丝要求\)**。方案基于官方 API,合规稳定、API 免费,部署在现有云端基本零增量成本。

---

## 二、方案简介

### 用什么方案

一个自研中央服务器对接 Meta 官方 Graph API。每个矩阵号通过官方 OAuth 授权流连接进来,后台统一监听评论、匹配关键词、自动发送私信。整套逻辑挂在公司现有云服务上,复用现有基础设施。

### 接入的核心 API

需申请的权限:`instagram_basic`、`instagram_manage_comments`、`instagram_manage_messages`、`pages_show_list`、`pages_manage_metadata`、`pages_read_engagement`。

### 主要约束条件\(均已纳入设计\)

---

## 三、技术详情\(供技术评审\)

### 技术栈

- 中央服务器:Node\.js\(复用现有 Next\.js 服务\)

- 异步解耦:BullMQ \+ Redis\(队列 / 限速 / 去重\)

- 存储:MySQL\(账号 Token、ID、状态、流水\)

- 安全:OAuth state 防 CSRF;Page Token 经 AES\-256\-GCM 加密入库

### 整体架构

```Plain Text
[矩阵号 OAuth 授权] ──> ig_accounts(加密 Token 入库)
                                 │
[用户评论 Reels] ──> Meta ──Webhook──> 中央服务器(验签 → 入队 → 立即 200)
                                          │
                            [异步 Worker] ─┤ 去重(Redis 24h)
                                          │ 关键词匹配
                                          │ 限速 + 随机延迟(模拟真人)
                                          ├─> 发送私信(Private Reply)
                                          └─> 落库审计
```

### 关键代码逻辑

① OAuth「两次置换」换取永久 Token

```Plain Text
// 回调:code → 短期token → 长期user token(60天)→ Page Token(永久)
const short = await GET('/oauth/access_token', { client_id, client_secret, redirect_uri, code });
const long  = await GET('/oauth/access_token', { grant_type: 'fb_exchange_token', client_id, client_secret, fb_exchange_token: short.access_token });
const pages = await GET('/me/accounts', { access_token: long.access_token }); // Page Token 永久
// → 取 IG 账号ID,AES 加密 Page Token 入库,订阅 Webhook
```

② Webhook 承接\(只做验签→入队→200,抗爆款\)

```Plain Text
const expected = 'sha256=' + hmacSHA256(APP_SECRET, rawBody);
if (!timingSafeEqual(sig, expected)) return 401;
for (const entry of body.entry) for (const c of entry.changes) {
  if (c.field !== 'comments') continue;
  await queue.add('process', {
    igAccountId: entry.id,        // 分流键:哪个矩阵号
    commentId: c.value.id,        // 私信用
    fromId: c.value.from.id,      // 评论用户
    text: c.value.text,
  }, { delay: rand(2000, 5000) });
}
return 200;
```

③ Worker:去重 \+ 限速 \+ 发私信

```Plain Text
if (!matchKeyword(text, rule.keywords)) return;                 // 不命中忽略
if (await redis.set(`dedup:${fromId}:${mediaId}`, 1, 'EX', 86400, 'NX') !== 'OK') return; // 24h 去重
await rateLimit(igAccountId);                                   // 每号限速
await sleep(rand(3000, 7000));                                  // 模拟真人延迟
await POST(`/${igAccountId}/messages`, {
  recipient: { comment_id: commentId },                         // Private Reply
  message: { text: spintax(rule.dm_template) },                 // 话术随机池防雷同
  access_token: decrypt(acc.page_token_enc),
});
```

### 数据库表结构\(MySQL,核心\)

```Plain Text
CREATE TABLE ig_accounts (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  ig_user_id VARCHAR(32) NOT NULL UNIQUE,        -- Instagram 账号 ID(Webhook 分流键)
  ig_username VARCHAR(64) NOT NULL,
  page_id VARCHAR(32) NOT NULL,                  -- 绑定的 FB Page
  page_token_enc VARBINARY(512) NOT NULL,        -- 永久 Page Token(加密)
  user_token_expires_at DATETIME NOT NULL,
  status ENUM('active','paused','reauth_required','banned') DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE comment_rules (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  ig_user_id VARCHAR(32) NOT NULL,
  media_id VARCHAR(32) NULL,                      -- NULL=全局生效
  keywords JSON NOT NULL,
  dm_template TEXT NOT NULL,                      -- 含 Spintax 文案
  public_reply TINYINT(1) DEFAULT 0,
  do_like TINYINT(1) DEFAULT 0,
  enabled TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE dm_logs (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  ig_user_id VARCHAR(32) NOT NULL,
  comment_id VARCHAR(64) NOT NULL,
  status ENUM('sent','failed','deduped') NOT NULL,
  message_id VARCHAR(128) NULL,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 防封号策略

1. 仅"用户主动评论关键词后"触发私信\(官方合规口径,非主动群发\)。

2. 每号限速\(留安全余量\)\+ 随机 3–7s 延迟,模拟真人。

3. 私信文案 Spintax 随机池 \+ 外链差异化,避免百号同一句话。

4. 前台养号/发帖在指纹浏览器\+独立住宅 IP 隔离;单号异常自动熔断,不连累整体 App。

### 落地排期

---

> 完整执行版\(四阶段逐步骤 \+ 全部代码 \+ 完整表结构\)见:`2026-06-18-ig-comment-to-dm-execution-plan.md`
> 
> \</content\>
> 
> 



