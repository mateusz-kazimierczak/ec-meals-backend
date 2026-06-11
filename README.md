# EC Meals Backend

Fastify API server powering the EC Meals system. It handles authentication, meal signup state, admin day management, notification preferences, activity emails, and audit/history logs.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Fastify |
| Primary app data | Local MongoDB via Mongoose |
| Audit/history data | Local PostgreSQL via `pg` |
| Auth | JWT via `jose` and `jsonwebtoken` |
| Email/rendering | Resend + React Email |
| Activity campaigns | Mailchimp Marketing API |
| Tests | Vitest + Fastify `app.inject()` |
| Deployment | Docker Compose + Traefik + Tailscale Funnel |

## Runtime Data Stores

Production data is local to this server:

- MongoDB container: `ec-meals-mongodb`
- MongoDB database: `ec_meals`
- PostgreSQL container: `postgres`
- PostgreSQL database: `ec_meals`

PostgreSQL stores:

- `meal_history`
- `user_settings_history`

The API intentionally preserves the old frontend-facing log response shape, including fields such as `CHANGE_TIME.value`, `OLD_MEALS`, and `NEW_MEALS`.

## Configuration

Runtime configuration is read from environment variables. Production values are loaded by `compose.yml` from `/home/ec/.env`.

```env
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

MONGODB_URI=mongodb://...
POSTGRES_URL=postgres://...

JWT_SECRET=...
INTERNAL_API_SECRET=...

ADMIN_USERNAME=admin
ADMIN_PASSWORD=...
ADMIN_EMAIL=admin@example.com

RESEND_API_KEY=re_...
ENABLE_EMAIL=true

MAILCHIMP_API_KEY=...
MAILCHIMP_REPLY_TO=...
MAILCHIMP_LIST_ID=...
MAILCHIMP_TEMPLATE_ID=...

AIRFLOW_API_URL=...
AIRFLOW_USER=...
AIRFLOW_PASSWORD=...
```

Test-only configuration lives in `.env.test.local`, with a safe template in `.env.test.example`.

## Running Locally

If Node is available:

```bash
npm install
npm run dev
npm run build
npm start
```

On this server, Docker-based commands are preferred:

```bash
docker run --rm -v /home/ec/ec-meals-backend:/app -w /app node:22-alpine npm run build
docker run --rm -v /home/ec/ec-meals-backend:/app -w /app node:22-alpine npm run lint
docker run --rm --network db_internal -v /home/ec/ec-meals-backend:/app -w /app node:22-alpine npm test
```

## Deployment

The backend is exposed internally through Traefik and publicly through Tailscale Funnel at:

```text
https://ec-debian-server.tail8c1956.ts.net/ec-meals-api
```

Traefik strips `/ec-meals-api` before forwarding traffic to the backend, so Fastify serves routes as `/api/...`.

Start or rebuild the backend stack:

```bash
docker compose -f compose.yml up -d --build
```

## API Summary

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth` | Login with username/password and receive a JWT |
| GET/POST | `/api/meals` | Get or update user meal preferences |
| POST/PATCH | `/api/day` | Get or modify daily meal reports |
| POST | `/api/day/removeUser` | Remove a user or guest from a day |
| GET | `/api/home/meals` | Current/tomorrow meals for the signed-in user |
| GET | `/api/home/birthdays` | Upcoming birthday display |
| GET | `/api/home/current_meals` | Current meal report for dashboard |
| GET | `/api/home/current-activity` | Current activity card |
| GET | `/api/users/all` | List users |
| GET/POST/PATCH/DELETE | `/api/users/single` | Manage one user |
| POST | `/api/users/batch/notifications` | Batch update notification preferences |
| GET/POST | `/api/preferences` | Get or update general preferences |
| GET/POST | `/api/preferences/notifications` | Get or update notification preferences |
| POST | `/api/preferences/notifications/addDevice` | Register a push device |
| GET/POST/DELETE | `/api/diets` | Manage diet types |
| GET/POST | `/api/settings` | Manage app settings |
| GET | `/api/logs` | Read meal change logs from PostgreSQL |
| GET | `/api/logs/userSettings` | Read user settings audit logs from PostgreSQL |
| GET/POST/PATCH/DELETE | `/api/activities` and `/api/activities/:id` | Manage Mailchimp activity campaigns |
| GET | `/healthz`, `/readyz` | Health and readiness checks |

## Project Structure

```text
src/
├── app.js                 # Fastify app factory
├── server.js              # Process entrypoint
├── plugins/auth.js        # JWT and role authorization hooks
├── routes/                # Native Fastify route modules
├── lib/                   # Shared request/audit helpers
├── domain/                # Domain defaults/constants
└── _helpers/              # Mongoose models, email, settings, time, Postgres helpers

test/
├── helpers/               # App/test DB/fixture/mock helpers
└── routes/                # Integration tests by route domain
```

## Documentation Rule

When adding or changing a feature, update docs in the same change. At minimum:

- Update this README for public API, deployment, env, or data-store changes.
- Update `docs/testing.md` for test helper, fixture, or command changes.
- Update `AGENTS.md` for architecture and workflow assumptions future agents need.
