import { closePostgresPool, ensurePostgresSchema, getPostgresPool } from "../../src/_helpers/postgres.js";

export const resetTestPostgres = async () => {
  await ensurePostgresSchema();
  await getPostgresPool().query(`
    TRUNCATE TABLE
      notification_devices,
      notification_windows,
      notification_rules,
      guest_signups,
      daily_no_meals,
      meal_signups,
      meal_services,
      activities,
      notification_preferences,
      user_preferences,
      users,
      diets,
      settings,
      meal_history,
      user_settings_history
    RESTART IDENTITY CASCADE
  `);
};

export const resetTestDatabases = async () => {
  await resetTestPostgres();
};

export const closeTestDatabases = async () => {
  await closePostgresPool();
};
