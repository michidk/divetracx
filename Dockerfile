# syntax=docker/dockerfile:1@sha256:4edf897a3ffa55b89f906fc8cc78afdb3f1834cc9c7083565e611a8a7d5fe99e

FROM oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS builder

WORKDIR /app

COPY package.json bun.lock ./
COPY patches ./patches
RUN apt-get update && \
    apt-get install --yes --no-install-recommends python3 make g++ && \
    bun install --frozen-lockfile && \
    rm -rf /var/lib/apt/lists/*

COPY . .
RUN bun run build

FROM oven/bun:1.4.4-slim@sha256:1846adf22496bd711036aae8be147e57bdebbaea2e5264e3e0b5af1db187d9a4 AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid 1001 --create-home --shell /usr/sbin/nologin app

COPY --from=builder --chown=app:nodejs /app/package.json /app/bun.lock ./
COPY --from=builder --chown=app:nodejs /app/patches ./patches
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
