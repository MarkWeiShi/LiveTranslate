# LinkU backend (NestJS + Prisma/SQLite + Socket.IO) — Fly.io 生产镜像。
# 仅装 backend + @linku/shared 两个 workspace（不装 app/expo）；以 ts-node 运行（与现有一致）。
# SQLite 落在挂载卷 /data（见 fly.toml [[mounts]]）；启动时迁移 + 种子（mock 演示账号）+ 起服务。
FROM node:20-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# 1) 依赖层：只复制 workspace 清单（app 只要清单存在以满足 workspace 图，不装其依赖）
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY backend/package.json backend/package.json
COPY app/package.json app/package.json
RUN npm install -w backend --no-audit --no-fund

# 2) 源码 + Prisma client
COPY packages/shared packages/shared
COPY backend backend
RUN npm -w backend exec -- prisma generate

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# 启动：迁移(幂等) → 种子(幂等 upsert，mock 演示账号) → 起服务
CMD ["sh","-c","cd backend && npx prisma migrate deploy && npx ts-node -r tsconfig-paths/register prisma/seed.ts && exec npx ts-node -r tsconfig-paths/register src/main.ts"]
