// Telegram Mini App 启动上下文解析（获客归因，BuildSpec 赛道一 M3 / Telegram生态分析）。
// 单一数据源：backend（记录归因）与 app（H5 启动时上报）共用本解析器，避免两端漂移。
//
// ⚠️ 安全注意：真实环境必须用 bot token 校验 initData 的 hash（HMAC-SHA256）后才可信。
// 该校验属于「接真实 Telegram Bot」范围 = human checkpoint，本 mock 阶段刻意不做，
// 仅做结构解析；切真实时在 backend 增加 verifyTelegramInitData(botToken) 守卫。

export interface TelegramUser {
  id: number;
  username?: string;
  firstName?: string;
  languageCode?: string;
}

export interface TelegramLaunchContext {
  source: 'telegram';
  user?: TelegramUser;
  /** deep-link / 邀请码载荷（Telegram startapp/start_param），用于回流归因漏斗 */
  startParam?: string;
  authDate?: number;
  raw: string;
}

/** 解析 Telegram WebApp `initData`（URL 编码的 query string）为结构化启动上下文。纯函数、无副作用。 */
export function parseTelegramInitData(initData: string): TelegramLaunchContext {
  const raw = initData ?? '';
  const p = new URLSearchParams(raw);

  let user: TelegramUser | undefined;
  const userJson = p.get('user');
  if (userJson) {
    try {
      const j = JSON.parse(userJson) as Record<string, unknown>;
      if (j && j.id != null) {
        user = {
          id: Number(j.id),
          username: typeof j.username === 'string' ? j.username : undefined,
          firstName: typeof j.first_name === 'string' ? j.first_name : undefined,
          languageCode: typeof j.language_code === 'string' ? j.language_code : undefined,
        };
      }
    } catch {
      /* 非法 user JSON → 忽略，仅保留其余字段 */
    }
  }

  const startParam = p.get('start_param') ?? undefined;
  const authDateRaw = p.get('auth_date');
  const authDate = authDateRaw && /^\d+$/.test(authDateRaw) ? Number(authDateRaw) : undefined;

  return { source: 'telegram', user, startParam, authDate, raw };
}

// 归因端点契约（AttributionBody / AttributionDto）已移到 ./attribution.ts（多渠道）。
