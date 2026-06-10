# EC Meals Backend

Next.js 14 API server powering the EC Meals system. Handles user authentication, meal scheduling, admin day management, email summaries, and meal history analytics.

## What It Does

- Authenticates users and issues JWT tokens
- Stores and retrieves user meal preferences (7-day rolling matrix)
- Provides daily meal rosters for admin views and kitchen planning
- Manages push notification device registration

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database | MongoDB Atlas (Mongoose) |
| Auth | JWT (jose + jsonwebtoken) + bcryptjs |
| Email | Resend + React Email |
| Analytics | Google BigQuery |
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

UPDATE_TIME=0830  # Legacy fallback if no schedule config exists in MongoDB settings

RESEND_API_KEY=re_...
ENABLE_EMAIL=true
GCP_AUTH={"type":"service_account",...}
```

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
| GET | `/api/logs/userSettings` | View user settings audit logs |
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

The active daily matrix shift now runs from the Airflow `daily_meals_update` DAG in `meal-DAGs/`.

## Data Storage

- **MongoDB**: User profiles, daily meal records, diet types, preferences
- **BigQuery**:
  - Meal change log: `ec-meals-462913.meal_history.HISTORY`
  - User settings change log: `ec-meals-462913.meal_history.USER_SETTINGS_HISTORY`

## Deployment

The app deploys as a standard long-running Next.js API service. Daily meal advancement is handled outside this repo segment by the Airflow DAGs in `meal-DAGs/`.

## Known Issues / Todo

- Email sending on Vercel can hit the serverless function timeout limit on large user sets
