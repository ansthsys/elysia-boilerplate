# Bundled entries: server + the two release/ops scripts, so the runtime image
# never needs TypeScript sources. Migrations stay a separate command.
FROM oven/bun:1.3-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.3-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock tsconfig.json ./
COPY src ./src
RUN bun run build

FROM oven/bun:1.3-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY --from=build /app/dist ./dist
# SQL files are read at runtime by the migrator, not bundled.
COPY drizzle ./drizzle
# The local storage driver writes here; docker-compose mounts a volume on it.
RUN mkdir -p /app/storage && chown -R bun:bun /app/storage
USER bun
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
# Migrations are a separate release step so replicas never run them concurrently:
#   docker run --rm <image> bun dist/db/migrate.js --no-create-db
CMD ["bun", "dist/index.js"]
