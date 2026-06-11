# Testing Guide

The backend test suite uses Vitest with Fastify `app.inject()`. Tests do not open network ports and should never touch production databases.

## Test Databases

Tests use isolated local databases:

- MongoDB: `ec_meals_test`
- PostgreSQL: `ec_meals_test`

Production uses:

- MongoDB: `ec_meals`
- PostgreSQL: `ec_meals`

The test setup maps:

- `MONGODB_URI_TEST` to `MONGODB_URI`
- `POSTGRES_URL_TEST` to `POSTGRES_URL`

Local test secrets live in `.env.test.local`. Commit only `.env.test.example`.

## Running Tests

Use Docker on this server:

```bash
docker run --rm --network db_internal -v /home/ec/ec-meals-backend:/app -w /app node:22-alpine npm test
```

Run one file:

```bash
docker run --rm --network db_internal -v /home/ec/ec-meals-backend:/app -w /app node:22-alpine npx vitest run test/routes/day.test.js
```

The `--network db_internal` flag is required so `mongodb` and `postgres` resolve.

## Test Structure

- `test/setup.js` loads test env, resets databases before each test, and blocks unexpected external fetches.
- `test/helpers/databases.js` owns test DB reset/close helpers.
- `test/helpers/app.js` builds Fastify apps with `logger: false`.
- `test/helpers/fixtures.js` creates users, days, activities, tokens, and meal matrices.
- `test/helpers/externalMocks.js` provides strict Airflow and Mailchimp mocks.
- `test/routes/*.test.js` contains integration coverage by route domain.

## Writing New Tests

- Prefer integration tests with real `ec_meals_test` Mongo/Postgres data.
- Use `buildTestApp()` and `injectJson()` for route tests.
- Use `seedUsers()`, `createUser()`, `createDay()`, and `createActivity()` instead of hand-rolling repeated setup.
- Use `vi.setSystemTime()` for date-sensitive day/home logic.
- Mock external services explicitly. Unexpected `fetch()` calls fail by default.
- Assert frontend-facing response shapes where compatibility matters.

## Coverage Expectations

Add or update tests when changing:

- Route auth or role requirements.
- Request/response shapes.
- Meal signup/day/home scheduling logic.
- Mongo model behavior.
- PostgreSQL audit/history writes.
- Mailchimp, Airflow, Resend, or other external integrations.

Run the full verification set before considering backend work complete:

```bash
docker run --rm --network db_internal -v /home/ec/ec-meals-backend:/app -w /app node:22-alpine npm test
docker run --rm -v /home/ec/ec-meals-backend:/app -w /app node:22-alpine npm run build
docker run --rm -v /home/ec/ec-meals-backend:/app -w /app node:22-alpine npm run lint
docker run --rm -v /home/ec/ec-meals-backend:/app -w /app node:22-alpine npm audit --omit=dev
```
