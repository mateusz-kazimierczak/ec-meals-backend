# EC Meals Backend — CLAUDE.md

## Project Overview
Next.js 14 API backend for the EC Meals system. Handles authentication, meal scheduling, user management, push notifications, and a daily automated cron job that emails meal summaries and logs to BigQuery.

## Tech Stack
- **Framework**: Next.js 14 (App Router, API routes only)
- **Database**: MongoDB via Mongoose
- **Auth**: JWT (jose in middleware, jsonwebtoken in routes) + bcryptjs
- **Email**: Resend + React Email components
- **Analytics/Audit**: Google BigQuery
- **Deployment**: Vercel (with built-in cron support)

## Key Files
- `src/app/api/` — All API route handlers
- `src/app/api/internal/dailyUpdate/route.js` — Cron job: updates meal matrices, sends emails, logs to BigQuery
- `src/middleware.js` — JWT verification; injects `userID` and `userRole` into response headers
- `src/_helpers/db/connect.js` — Mongoose connection with global caching
- `src/_helpers/db/models/` — Mongoose schemas: `User`, `Day`, `Diet`
- `src/_helpers/time.js` — Timezone utilities (all logic uses America/Toronto)
- `src/_helpers/emails.jsx` — Email sending helpers using Resend
- `emails/` — React Email templates (`DailyEmail.jsx`, `WelcomeEmail.jsx`)
- `vercel.json` — Cron schedule: `30 8 * * *` (8:30 AM daily)
- `.env.local` — All secrets

## Environment Variables
| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | JWT signing secret |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_EMAIL` | Initial admin credentials |
| `UPDATE_TIME` | Daily cron trigger time in HHMM (e.g. `0830`) |
| `RESEND_API_KEY` | Resend email API key |
| `ENABLE_EMAIL` | `true` / `false` to toggle emails |
| `GCP_AUTH` | Google Cloud service account JSON (stringified) |
| `CLIENT_ID` / `CLIENT_SECRET` | Google OAuth credentials |

## Running Locally
```bash
npm run dev     # Start dev server on port 3000 with Node inspector
npm run build   # Production build
npm run start   # Start production server
npm run email   # React Email dev server
```

## API Endpoints Summary
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth` | None | Login → JWT |
| GET/POST | `/api/meals` | User | Get/set meal preferences |
| POST/PATCH/DELETE | `/api/day` | User/Admin | Daily meal report |
| GET | `/api/users/all` | Admin | List all users |
| GET/PATCH | `/api/users/single` | User | Get/update user |
| GET/PATCH | `/api/preferences` | User | User preferences |
| POST | `/api/preferences/notifications/addDevice` | User | Register push token |
| GET/POST/DELETE | `/api/diets` | Admin | Diet management |
| GET | `/api/logs` | User | Change logs |
| GET | `/api/internal/dailyUpdate` | Internal | Trigger daily cron |

## Architecture Notes
- **Meal matrix**: Users store a 7-day × 7-slot matrix. Indices 0-2 = B/L/D, 3-5 = packed P1/P2/PS, 6 = no-meals flag
- **Timezone**: All date/time logic hardcoded to `America/Toronto` via `moment-timezone`
- **Hybrid storage**: User preferences in MongoDB; meal change history in BigQuery (`ec-meals-462913.meal_history.HISTORY`)
- **Predictive vs historical**: Future dates → compute from user matrices; past dates → return stored Day documents
- **Middleware**: Protected routes checked in `src/middleware.js`; role check (admin) done inline in route handlers

## Cron Job Behavior (dailyUpdate)
1. Advances each user's meal matrix by one day
2. Creates a `Day` document for today with all scheduled meals
3. Sends daily summary emails via Resend
4. Logs meal changes to BigQuery

## Known Issues / TODOs (from README)
- Users may be added twice in daily update — needs deduplication guard
- Email sending can time out on Vercel's serverless function limit
