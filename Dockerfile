FROM oven/bun:1.3-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.3-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
COPY drizzle ./drizzle
USER bun
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
# The server only. Migrations are a separate release step so several replicas
# never run them concurrently:  docker run <image> bun run src/db/migrate.ts
CMD ["bun", "run", "src/index.ts"]
