# syntax=docker/dockerfile:1@sha256:572cebbc2b15e6f84c077742952674889cb63cd5e9b80abdffcbe587b6f19183

FROM oven/bun:1.4.5@sha256:3aa040e5445efa09d75bb428a64ba50db13e2b3ac9b6b0c7f145615f62b2ee18 AS builder

WORKDIR /app

COPY package.json bun.lock ./
COPY patches ./patches
RUN apt-get update && \
    apt-get install --yes --no-install-recommends python3 make g++ && \
    bun install --frozen-lockfile && \
    rm -rf /var/lib/apt/lists/*

COPY . .
RUN bun run build

FROM oven/bun:1.4.5-slim@sha256:b780593f3e10918cbdaec3d5a08d52224b9198069a65eb47812085c2ec007643 AS runner

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
