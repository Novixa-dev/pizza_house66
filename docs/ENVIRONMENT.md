# Environment

Copy `.env.example` to `.env` and fill it in. `.env` is gitignored; nothing
in this repository contains a real secret.

## Variables

| Variable | Required | What it does |
|---|---|---|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string. The Prisma datasource is `postgresql` and the migrations are Postgres SQL — SQLite will not work. |
| `AUTH_SECRET` | **Yes** | Signs staff session cookies (`src/lib/auth.ts`, `src/proxy.ts`). Must be ≥ 32 characters; the app throws rather than sign with a short key. Rotating it signs every staff member out and touches nothing else. |
| `CRON_SECRET` | Production | Bearer token for `/api/cron/release-orders`. **Unset means the endpoint returns 401** — it fails closed. Without it, kitchen release falls back to happening whenever staff load the kitchen or orders page. |
| `NEXT_PUBLIC_APP_URL` | Recommended | Public origin for canonical URLs, Open Graph, the sitemap and tracking links. Falls back to `VERCEL_PROJECT_PRODUCTION_URL`, then `VERCEL_URL`, then `http://localhost:3000` (`src/lib/site.ts`). Client-visible — never a secret. |
| `SEED_STAFF_PASSWORD` | No | Password for the demo accounts `npm run db:seed` creates. Defaults to `ChangeMe123!`. Development only. |

Set automatically by the host and read but never written by this app:
`NODE_ENV`, `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL`.

Test-only: `PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_PORT`,
`PLAYWRIGHT_CHROMIUM_PATH`, `STAFF_PASSWORD`, `CI` — see `docs/TESTING.md`.

### Generating secrets

```bash
openssl rand -hex 32
```

Use a different value for `AUTH_SECRET` and `CRON_SECRET`, and a different
one again per environment. Two environments sharing `AUTH_SECRET` means a
session minted on staging is valid in production.

## Local setup from nothing

```bash
cp .env.example .env
sed -i "s/replace-with-a-long-random-secret/$(openssl rand -hex 32)/" .env

npm install
npm run db:migrate:dev
npm run db:seed
npm run dev
```

### If you have no PostgreSQL

With Docker:

```bash
docker run -d --name pizzahouse-db \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pizzahouse \
  -p 5432:5432 postgres:16
```

Then set:

```
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/pizzahouse?schema=public"
```

With a local install and no Docker (what the build container used):

```bash
export PGDATA=/var/lib/postgresql/phdata
initdb -D "$PGDATA" -U postgres
echo "port = 5433"                  >> "$PGDATA/postgresql.conf"
echo "listen_addresses = '127.0.0.1'" >> "$PGDATA/postgresql.conf"
pg_ctl -D "$PGDATA" -l "$PGDATA/server.log" start
createdb -h 127.0.0.1 -p 5433 -U postgres pizzahouse
```

```
DATABASE_URL="postgresql://postgres@127.0.0.1:5433/pizzahouse?schema=public"
```

## Migrations, not `db push`

There is no `db:push` script, deliberately. `prisma db push` mutates a schema
without recording how, which is fine for a scratch database and wrong for one
holding a restaurant's orders. Development uses `npm run db:migrate:dev`
(writes a migration); deployment uses `npm run db:migrate`
(`prisma migrate deploy`, applies what is committed and nothing else).

## Demo accounts

`npm run db:seed` creates four staff accounts, one per role, and prints them.
They exist so a reviewer can see each permission level immediately. They are
**not** for production — `docs/HANDOVER.md` covers replacing them with real
accounts via `npm run staff:create`.
