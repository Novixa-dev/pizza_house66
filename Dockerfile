# syntax=docker/dockerfile:1
#
# The restaurant's app, built the way CI builds it: production dependencies
# only (`npm ci --omit=dev`). That is not an optimisation — it is the check
# that caught the Tailwind plugin sitting in devDependencies — so the image
# uses the same install and cannot drift from it.
#
# Node 20 (.nvmrc). Debian rather than Alpine because Prisma's engines want
# glibc and OpenSSL, and an engine that fails to load is a container that
# restarts forever.

FROM node:20-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---------------------------------------------------------------------------
FROM base AS build

# `postinstall` runs `prisma generate`, so the schema has to be there first.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev

COPY . .

# Public values baked into the browser bundle. The database URL is a stand-in:
# the build does not need a database (pages that read one are dynamic, and the
# few that touch it at build time fall back), but Prisma wants the variable to
# exist. Nothing secret is built into the image.
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"
RUN npm run build

# ---------------------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000

# Wait for Postgres, apply migrations, set up an EMPTY database once, start.
# `db:bootstrap` — not `db:seed` — because the seed overwrites prices and
# hides products it does not know; see src/server/bootstrap.ts.
CMD ["sh", "-c", "node scripts/wait-for-db.mjs && npm run db:migrate && npm run db:bootstrap && exec npm start"]
