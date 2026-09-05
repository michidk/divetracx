# syntax=docker/dockerfile:1

FROM oven/bun:1.4.2 AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN apt-get update && \
    apt-get install --yes --no-install-recommends python3 make g++ && \
    bun install --frozen-lockfile && \
    rm -rf /var/lib/apt/lists/*

COPY . .
RUN bun run build

FROM oven/bun:1.4.2-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid 1001 --create-home --shell /usr/sbin/nologin app

COPY --from=builder --chown=app:nodejs /app/package.json /app/bun.lock ./
RUN apt-get update && \
    apt-get install --yes --no-install-recommends python3 make g++ && \
    bun install --frozen-lockfile --production && \
    apt-get purge --yes --auto-remove python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

RUN apt-get update && \
    apt-get install --yes --no-install-recommends fontconfig fonts-dejavu-core && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder --chown=app:nodejs /app/.output ./.output
COPY --from=builder --chown=app:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=app:nodejs /app/scripts ./scripts
COPY --from=builder --chown=app:nodejs /app/src ./src
COPY --from=builder --chown=app:nodejs /app/tsconfig.json ./tsconfig.json

USER app
EXPOSE 3000

CMD ["bun", ".output/server/index.mjs"]
