CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS diets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT,
  birthday_month INTEGER CHECK (birthday_month IS NULL OR birthday_month BETWEEN 1 AND 12),
  birthday_day INTEGER CHECK (birthday_day IS NULL OR birthday_day BETWEEN 1 AND 31),
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'activity_editor')),
  email TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  room INTEGER,
  guest BOOLEAN NOT NULL DEFAULT FALSE,
  diet_id UUID REFERENCES diets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  allow_next_week BOOLEAN NOT NULL DEFAULT FALSE,
  persist_meals BOOLEAN NOT NULL DEFAULT FALSE,
  skip_not_signed_up BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  push_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_rules (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('missing_regular_meals', 'missing_packed_meals', 'missing_any_meals', 'full_report', 'report_on_notifications')),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, rule_type, day_of_week)
);

CREATE TABLE IF NOT EXISTS notification_windows (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  window TEXT NOT NULL CHECK (window IN ('morning', 'noon', 'evening')),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, window, day_of_week)
);

CREATE TABLE IF NOT EXISTS notification_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name TEXT,
  expo_push_token TEXT NOT NULL,
  platform TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailchimp_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  activity_name TEXT NOT NULL DEFAULT '',
  activity_date TIMESTAMPTZ NOT NULL,
  send_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'save' CHECK (status IN ('save', 'draft', 'schedule', 'sending', 'sent', 'paused', 'cancelled')),
  body TEXT NOT NULL,
  emails_sent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meal_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'packed_1', 'packed_2', 'packed_supper')),
  cutoff_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked', 'finalized')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (service_date, meal_type)
);

CREATE TABLE IF NOT EXISTS meal_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meal_service_id UUID NOT NULL REFERENCES meal_services(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'unmarked' CHECK (status IN ('attending', 'not_attending', 'unmarked')),
  source TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'admin', 'system')),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, meal_service_id)
);

CREATE TABLE IF NOT EXISTS daily_no_meals (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_date DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'admin', 'system')),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, service_date)
);

CREATE TABLE IF NOT EXISTS guest_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_service_id UUID NOT NULL REFERENCES meal_services(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  diet TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meal_history (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  change_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_system_change BOOLEAN NOT NULL DEFAULT FALSE,
  old_meals JSONB,
  new_meals JSONB
);

CREATE INDEX IF NOT EXISTS meal_history_user_time_idx
  ON meal_history (user_id, change_time DESC);

CREATE TABLE IF NOT EXISTS user_settings_history (
  id BIGSERIAL PRIMARY KEY,
  change_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_user_id TEXT,
  actor_role TEXT,
  target_user_id TEXT NOT NULL,
  change_type TEXT NOT NULL,
  is_batch BOOLEAN NOT NULL DEFAULT FALSE,
  changed_fields JSONB NOT NULL,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB,
  request_path TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS user_settings_history_target_time_idx
  ON user_settings_history (target_user_id, change_time DESC);
