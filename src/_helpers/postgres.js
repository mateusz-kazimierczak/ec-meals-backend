import pg from "pg";

const { Pool } = pg;

let pool;
let schemaReady = false;

const requiredDatabaseUrl = () => {
  const databaseUrl = process.env.POSTGRES_URL;
  if (!databaseUrl) {
    throw new Error("Please define the POSTGRES_URL environment variable.");
  }
  return databaseUrl;
};

export const getPostgresPool = () => {
  if (!pool) {
    pool = new Pool({
      connectionString: requiredDatabaseUrl(),
      max: Number(process.env.POSTGRES_POOL_SIZE || 10),
    });
  }
  return pool;
};

export const query = async (text, params) => {
  await ensurePostgresSchema();
  return getPostgresPool().query(text, params);
};

export const ensurePostgresSchema = async () => {
  if (schemaReady) return;

  await getPostgresPool().query(`
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
  `);

  schemaReady = true;
};

export const closePostgresPool = async () => {
  if (!pool) return;
  await pool.end();
  pool = null;
  schemaReady = false;
};
