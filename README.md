# EC Meals Backend

Next.js 14 API server powering the EC Meals system. Handles user authentication, meal scheduling, daily automated updates, email summaries, and meal history analytics.

## What It Does

- Authenticates users and issues JWT tokens
- Stores and retrieves user meal preferences (7-day rolling matrix)
- Provides daily meal rosters for admin views and kitchen planning
- Runs a daily cron job (8:30 AM Toronto time) that:
  - Advances every user's meal schedule by one day
  - Creates a snapshot of the day's meals in MongoDB
  - Sends a daily summary email to all users
  - Logs meal changes to Google BigQuery
- Manages push notification device registration

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database | MongoDB Atlas (Mongoose) |
| Auth | JWT (jose + jsonwebtoken) + bcryptjs |
| Email | Resend + React Email |
| Analytics | Google BigQuery |
| Cron | Vercel Cron (built-in) |
| Deployment | Vercel |

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (or local MongoDB)
- Resend account for emails
- Google Cloud project for BigQuery (optional but needed for full functionality)

### Installation
```bash
cd ec-meals-backend
npm install
```

### Configuration

Create `.env.local` in the root of this directory:

```env
MONGODB_URI=mongodb+srv://...
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-admin-password
ADMIN_EMAIL=admin@example.com
JWT_SECRET=your-secret-key

UPDATE_TIME=0830  # 8:30 AM — keep in sync with cron schedule in vercel.json

RESEND_API_KEY=re_...
ENABLE_EMAIL=true
GCP_AUTH={"type":"service_account",...}
```

> **Note**: When changing `UPDATE_TIME`, also update the cron schedule in `vercel.json`.

### Running

```bash
npm run dev     # Development server on http://localhost:3000
npm run build   # Production build
npm run start   # Start production server
npm run email   # React Email preview server
```

## API Reference

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth` | Login with username/password → JWT token |

### Meals
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/meals` | Get user's meal preferences |
| POST | `/api/meals` | Update meal preferences |
| POST | `/api/day` | Get daily meal report (today or historical) |
| PATCH | `/api/day` | Add users/guests to a day (admin) |
| DELETE | `/api/day/removeUser` | Remove user from a day |

### Users & Preferences
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users/all` | List all users (admin only) |
| GET/PATCH | `/api/users/single` | Get or update a user |
| GET/PATCH | `/api/preferences` | Get or update preferences |
| POST | `/api/preferences/notifications/addDevice` | Register push token |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| GET/POST/DELETE | `/api/diets` | Manage diet types |
| GET | `/api/logs` | View audit logs |
| GET | `/api/internal/dailyUpdate` | Trigger daily update (cron) |
| GET | `/api/internal/init` | Initialize admin user |

## Project Structure

```
ec-meals-backend/
├── src/
│   ├── app/
│   │   ├── api/              # All API route handlers
│   │   │   ├── auth/
│   │   │   ├── meals/
│   │   │   ├── day/
│   │   │   ├── users/
│   │   │   ├── preferences/
│   │   │   ├── diets/
│   │   │   ├── logs/
│   │   │   ├── home/
│   │   │   └── internal/     # Cron jobs & admin setup
│   ├── _helpers/
│   │   ├── db/
│   │   │   ├── connect.js    # MongoDB connection (cached)
│   │   │   └── models/       # User, Day, Diet schemas
│   │   ├── emails.jsx        # Resend email helpers
│   │   └── time.js           # Timezone utilities
│   └── middleware.js         # JWT auth middleware
├── emails/                   # React Email templates
├── vercel.json               # Cron schedule config
└── .env.local                # Environment variables (create this manually)
```

## How the Meal Matrix Works

Each user stores a 7-element array (one slot per day of the week). Each day slot has 7 meal sub-types:

| Index | Meal |
|---|---|
| 0 | Breakfast |
| 1 | Lunch |
| 2 | Dinner (Supper) |
| 3 | Packed meal P1 |
| 4 | Packed meal P2 |
| 5 | Packed meal PS |
| 6 | No meals flag |

The daily cron job shifts this matrix forward by one day, rolling the week over automatically.

## Data Storage

- **MongoDB**: User profiles, daily meal records, diet types, preferences
- **BigQuery**: Immutable audit log of all meal changes (`ec-meals-462913.meal_history.HISTORY`)

## Deployment (Vercel)

The app deploys to Vercel automatically. The cron job in `vercel.json` triggers `/api/internal/dailyUpdate` at 8:30 AM UTC daily.

```json
{
  "crons": [{"path": "/api/internal/dailyUpdate", "schedule": "30 8 * * *"}]
}
```

## Known Issues / Todo

- Users can occasionally be added twice during the daily update — a deduplication check should be added
- Email sending on Vercel can hit the serverless function timeout limit on large user sets
