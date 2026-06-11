# EC Meals Backend Agent Guide

## Current Architecture

This repository is the Fastify backend for EC Meals. Do not reintroduce Next.js API routes, Next middleware, or Next runtime assumptions.

- `src/app.js` builds the Fastify app and registers routes.
- `src/server.js` starts the HTTP server.
- `src/plugins/auth.js` enforces JWT and role-based access by route prefix.
- `src/routes/` contains route modules grouped by domain.
- `src/_helpers/db/models/` contains MongoDB/Mongoose models.
- `src/_helpers/postgres.js` owns PostgreSQL pooling and idempotent schema setup.
- `src/_helpers/mealHistory.js` and `src/_helpers/userSettingsAudit.js` write/read PostgreSQL audit data.
- `src/_helpers/time.js` contains Toronto-time meal scheduling logic.

The frontend expects the existing `/api/...` contract. In production, Traefik/Tailscale exposes the backend at `/ec-meals-api` and strips that prefix before requests reach Fastify.

## Data Stores

Production uses local containers:

- MongoDB service: `ec-meals-mongodb`
- Mongo database: `ec_meals`
- PostgreSQL container: existing `postgres`
- PostgreSQL database: `ec_meals`

Tests use isolated databases:

- Mongo database: `ec_meals_test`
- PostgreSQL database: `ec_meals_test`

Never point tests at production database URLs. Tests must use `MONGODB_URI_TEST` and `POSTGRES_URL_TEST` via `.env.test.local`.

## Development Commands

The host may not have Node installed. Prefer Docker-based commands:

```bash
docker run --rm -v /home/ec/ec-meals-backend:/app -w /app node:22-alpine npm run build
docker run --rm -v /home/ec/ec-meals-backend:/app -w /app node:22-alpine npm run lint
docker run --rm --network db_internal -v /home/ec/ec-meals-backend:/app -w /app node:22-alpine npm test
docker run --rm -v /home/ec/ec-meals-backend:/app -w /app node:22-alpine npm audit --omit=dev
```

The test command needs `--network db_internal` so the `mongodb` and `postgres` Docker DNS names resolve.

## Testing Expectations

- Use Fastify `app.inject()`; do not open real ports in tests.
- Reset test Mongo and Postgres data before each test.
- Use fake timers for date-sensitive day/home logic.
- Mock all external calls by default. Real Mailchimp, Airflow, Resend, or arbitrary network calls must not happen in tests.
- Add or update route tests whenever API behavior changes.

## Documentation Expectations

When adding or changing a feature, update documentation in the same change:

- Update `README.md` when public behavior, env vars, deployment, or API contracts change.
- Update `docs/testing.md` when test setup, helpers, fixtures, or commands change.
- Update this `AGENTS.md` when architecture, operational assumptions, data stores, or agent workflow changes.
- Document new environment variables with purpose, required/optional status, and whether they are production-only or test-only.

If a route response shape changes, mention frontend compatibility risk explicitly. The existing Expo/Vercel frontend depends on current field names, including BigQuery-compatible log fields such as `CHANGE_TIME.value`.

## Operational Notes

- Keep `INTERNAL_API_SECRET` configured for public deployments.
- Keep production and test databases separate.
- PostgreSQL schema creation is app-driven and idempotent through `ensurePostgresSchema()`.
- Mailchimp activity routes depend on Mailchimp env vars at module import time.
- Day/home logic is timezone-sensitive and should be reasoned about in `America/Toronto`.
