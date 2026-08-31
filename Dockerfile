# The web bundle is built in the first stage. The runtime stage keeps only the
# server source, the production dependencies, and the built bundle.
FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY tsconfig.json ./
COPY web ./web
COPY src ./src
RUN bun run build

FROM oven/bun:1-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY tsconfig.json ./
COPY src ./src
COPY --from=build /app/dist/web ./dist/web

USER bun
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
	CMD ["bun", "-e", "process.exit((await fetch('http://127.0.0.1:' + Bun.env.PORT + '/health')).ok ? 0 : 1)"]

CMD ["bun", "src/api/index.ts"]
