# Environment Variables

Copy `.env.example` to `.env` and fill in real values. Never commit `.env`.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | SQLite file path for dev/demo (`file:./dev.db`). Change to a PostgreSQL connection string for production and update `prisma/schema.prisma`'s `datasource.provider` accordingly — see `docs/DECISIONS.md`. |
| `AUTH_SECRET` | Yes | Signs staff session cookies (`src/lib/auth.ts`, `src/proxy.ts`). Generate with `openssl rand -base64 32`. Rotating it invalidates all active staff sessions. |
| `NEXT_PUBLIC_APP_URL` | No (dev default provided) | Public base URL; reserved for building absolute links (e.g. in future notification messages). Exposed to the client (`NEXT_PUBLIC_` prefix) — never put secrets here. |
| `SEED_STAFF_PASSWORD` | No | Only used by `prisma/seed.ts` to set the demo staff accounts' password. Defaults to `ChangeMe123!` if unset — **do not deploy the seeded demo accounts/password to production**; create real staff accounts with strong passwords instead. |

## Local setup

```bash
cp .env.example .env
sed -i "s/replace-with-a-long-random-secret/$(openssl rand -hex 32)/" .env
npm install
npm run db:push     # create the SQLite schema
npm run db:seed     # load demo restaurant/menu/staff data
npm run dev
```

Demo staff logins after seeding: `owner@pizzahouse.local` and
`kitchen@pizzahouse.local`, password from `SEED_STAFF_PASSWORD` (default
`ChangeMe123!`).
