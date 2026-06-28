// Telegram Bot API（Stars / XTR）轻封装。digital goods 用 XTR，无需 provider_token。
// 见 https://core.telegram.org/bots/payments-stars

async function tgApi(token: string, method: string, body: unknown): Promise<any> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export interface InvoiceParams {
  title: string;
  description: string;
  payload: string; // 1..128 字节，回调时原样带回
  prices: { label: string; amount: number }[]; // XTR: amount = 星星数
}

/** 创建 Stars 发票链接，前端用 Telegram.WebApp.openInvoice 打开。 */
export async function createStarsInvoiceLink(token: string, p: InvoiceParams): Promise<string> {
  const j = await tgApi(token, 'createInvoiceLink', {
    title: p.title,
    description: p.description,
    payload: p.payload,
    currency: 'XTR',
    provider_token: '', // XTR 留空
    prices: p.prices,
  });
  if (!j?.ok || !j.result) throw new Error(`createInvoiceLink failed: ${JSON.stringify(j)}`);
  return j.result as string;
}

/** 必须在 10s 内回应 pre_checkout_query，否则支付失败。 */
export async function answerPreCheckout(token: string, id: string, ok = true): Promise<void> {
  await tgApi(token, 'answerPreCheckoutQuery', { pre_checkout_query_id: id, ok });
}
