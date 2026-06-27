#!/usr/bin/env bash
# LiveTranslate (LinkU) 验证闸门 —— loop 的绿灯。全 mock、零密钥、本机端到端。
# 已实测通过：typecheck(shared+backend+app) + 27/27 验收冒烟 + H5(expo web)生产构建。
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$PWD"
export PATH="$HOME/.local/bin:$PATH"

echo "[1/7] install"; npm install --no-audit --no-fund >/dev/null
echo "[2/7] backend/.env（mock，零密钥）"; [ -f backend/.env ] || cp .env.example backend/.env
echo "[3/7] prisma generate + 重置 sqlite dev.db（确保 gate 幂等：每次干净库）"
npm -w backend exec -- prisma generate >/dev/null
rm -f backend/dev.db backend/dev.db-journal backend/prisma/dev.db backend/prisma/dev.db-journal 2>/dev/null || true
npm -w backend exec -- prisma migrate deploy >/dev/null
echo "[4/7] typecheck（shared + backend + app）+ 单元测试（shared 契约 + backend Telegram 校验）"
npm run typecheck
npm -w @linku/shared run test
npm -w backend run test:unit
echo "[5/7] seed + 启动后端（冒烟需要 :3000 在跑）"
cd backend
set -a; . ./.env; set +a
npx ts-node -r tsconfig-paths/register prisma/seed.ts >/dev/null
npx ts-node -r tsconfig-paths/register src/main.ts >/tmp/lt-backend.log 2>&1 & BPID=$!
trap 'kill $BPID 2>/dev/null || true' EXIT
until grep -q "listening on http://localhost:3000" /tmp/lt-backend.log 2>/dev/null; do
  kill -0 "$BPID" 2>/dev/null || { echo "BACKEND DIED"; cat /tmp/lt-backend.log; exit 1; }
done
echo "[6/7] 验收冒烟（60 断言：auth/discovery/safety + call/xlate/pay/gift/history + telegram 归因 + 多渠道/漏斗 + 巴别塔语聊房）"
node scripts/smoke.mjs
node scripts/reset-dev.mjs >/dev/null
node scripts/smoke-rt.mjs
echo "    └ 巴别塔语聊房（字幕 + 弹幕/上麦/传话/PK）"
node scripts/smoke-room.mjs
echo "    └ 跨语言狼人杀（私密角色 + 多语言主持 + 跨语言发言 + AI 兜底跑完一局）"
node scripts/smoke-werewolf.mjs
echo "    └ 成长体系（积分/等级 + CP 亲密度 + 家族战）"
node scripts/smoke-growth.mjs
kill "$BPID" 2>/dev/null || true; trap - EXIT

echo "[6b/7] 真实模式子运行：ATTRIBUTION_VERIFY=telegram + 测试 token（自签证明 HMAC HTTP 链路，无需真实 bot）"
GATE_TG_TOKEN='123456:GATE_TEST_TOKEN_not_real'
ATTRIBUTION_VERIFY=telegram TELEGRAM_BOT_TOKEN="$GATE_TG_TOKEN" \
  npx ts-node -r tsconfig-paths/register src/main.ts >/tmp/lt-backend-tg.log 2>&1 & TGPID=$!
trap 'kill $TGPID 2>/dev/null || true' EXIT
until grep -q "listening on http://localhost:3000" /tmp/lt-backend-tg.log 2>/dev/null; do
  kill -0 "$TGPID" 2>/dev/null || { echo "REAL-MODE BACKEND DIED"; cat /tmp/lt-backend-tg.log; exit 1; }
done
TELEGRAM_BOT_TOKEN="$GATE_TG_TOKEN" node scripts/smoke-tg.mjs
kill "$TGPID" 2>/dev/null || true; trap - EXIT
cd "$ROOT"
echo "[7/7] H5 生产构建：expo export -p web"; npm -w app run export:web >/dev/null
echo "GATE OK — 21 单元（13 shared + 8 backend: 5 Telegram + 3 LiveKit）+ 60 mock 冒烟（含语聊房+弹幕/上麦/传话）+ 4 真实模式冒烟（自签，含 Telegram 登录）+ typecheck + H5 构建。真实 Gemini/LiveKit/HelloTalk/RevenueCat/Telegram Bot 凭据与对外上线属 human checkpoint（见 TELEGRAM-SETUP.md / LIVEKIT-SETUP.md）。"
