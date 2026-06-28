# 接入步骤 · 送礼扣费 + Telegram Stars 充值

> 现状：**送礼扣费 + dev 充值 全部就绪并已测试**（smoke 26/26）。
> **Telegram Stars 真实支付**代码就绪（发票创建 + webhook 入账），只差一次 **setWebhook** 配置（human checkpoint）。
> 日期：2026-06-28

---

## 0. 已实现
- **送礼扣费**：服务端按礼物目录权威定价（rose1/beer9/love66/crown199/rocket520/castle1314），送礼原子扣发送者钻石，**不足返回 402** → 前端弹充值面板。
- **充值面板**：底部上滑，4 档充值包（💎/⭐）。
- **dev 充值**：`POST /wallet/recharge/dev`（非 Telegram / 联调直接入账，已测试）。
- **Telegram Stars**：`POST /wallet/recharge` 调 `createInvoiceLink(XTR)` 返回发票链接 → 前端 `Telegram.WebApp.openInvoice` → 支付成功经 webhook 入账。

## 1. 充值包（前后端共用，`packages/shared/src/payments.ts`）
| id | ⭐ Stars | 💎 钻石 |
|----|---------|--------|
| p1 | 50 | 50 |
| p2 | 100 | 110 |
| p3 | 300 | 350 |
| p4 | 1000 | 1300 |

## 2. 启用真实 Stars（你要做的一步）
后端已有 `TELEGRAM_BOT_TOKEN`（之前配过）。Stars 入账靠 Telegram 把支付回调发到我们的 webhook，需告诉 Telegram 地址：
```bash
curl "https://api.telegram.org/bot<你的BotToken>/setWebhook" \
  -H 'content-type: application/json' \
  -d '{"url":"https://linku-backend-mark.fly.dev/telegram/webhook","allowed_updates":["pre_checkout_query","message"]}'
```
> ⚠️ 这会把该 bot 的更新推送到此 webhook。本项目 bot 仅用于 Mini App 登录（客户端 initData，不依赖 getUpdates），故设 webhook 安全、不影响登录。
> 取消：`/deleteWebhook`。

校验：`curl https://api.telegram.org/bot<token>/getWebhookInfo`（看 url 是否生效、有无报错）。

## 3. 支付闭环（设好 webhook 后）
1. 用户在语聊房点 💎 余额或送礼遇余额不足 → 充值面板 → 选包。
2. 前端 `openInvoice(invoiceLink)` 唤起 Telegram Stars 支付。
3. Telegram → `pre_checkout_query`（webhook 10s 内 `answerPreCheckoutQuery ok`，已实现）。
4. 支付成功 → `message.successful_payment` → webhook 解析 payload 入账钻石（按 `telegram_payment_charge_id` 幂等去重）。
5. 前端 openInvoice 回调 `paid` → 刷新钱包余额。

## 4. 验证
- **本地/dev**：`/wallet/recharge/dev` 直接入账 → 送礼扣费 → 余额减少；smoke-room 已覆盖（26/26）。
- **真实 Stars**：设 webhook 后，在 Telegram 内真买一次最小包（50⭐）→ `fly logs` 应见 `Stars 入账 50💎 → <userId>`，钱包余额增加。
  - 注意：Stars 是真实付费货币，测试会真扣你的星星（可先用最小档）。

## 5. 红线 / 取舍
- `TELEGRAM_BOT_TOKEN` 仅在 `fly secrets`；webhook 无鉴权但只处理支付更新、入账走幂等。可选加 `secret_token`（setWebhook 带 `secret_token` + 校验请求头）增强，当前未做。
- 钻石目前是「消费币」：送礼即花掉，受赠方只涨**魅力值（展示）**，未做受赠方收益/提现。
- 退款/对账未做（MVP）。
