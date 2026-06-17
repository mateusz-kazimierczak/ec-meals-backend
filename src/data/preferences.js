import { defaultNotificationPreferences } from "../domain/notificationDefaults.js";
import { query } from "../db/index.js";

const cloneDefaults = () => JSON.parse(JSON.stringify(defaultNotificationPreferences));

const RULE_TYPES = {
  missingRegularMeals: "missing_regular_meals",
  missingPackedMeals: "missing_packed_meals",
  missingAnyMeals: "missing_any_meals",
  fullReport: "full_report",
  reportOnNotifications: "report_on_notifications",
};
const WINDOW_TYPES = ["morning", "noon", "evening"];

const normalizeWeek = (value, fallback = Array(7).fill(false)) => (
  Array.from({ length: 7 }, (_, index) => Boolean(Array.isArray(value) ? value[index] : fallback[index]))
);

const rowsToWeeks = (rows, keyColumn, keys, defaults) => {
  const output = Object.fromEntries(keys.map((key) => [key, [...defaults[key]]]));
  for (const row of rows) {
    const camelKey = Object.entries(RULE_TYPES).find(([, dbKey]) => dbKey === row[keyColumn])?.[0] || row[keyColumn];
    if (output[camelKey] && row.day_of_week >= 0 && row.day_of_week <= 6) {
      output[camelKey][row.day_of_week] = row.enabled;
    }
  }
  return output;
};

const normalizeNotifications = (pref = {}) => {
  const defaults = cloneDefaults();
  return {
    emailEnabled: Boolean(pref.emailEnabled),
    pushEnabled: Boolean(pref.pushEnabled),
    rules: Object.fromEntries(Object.keys(RULE_TYPES).map((key) => [
      key,
      normalizeWeek(pref.rules?.[key], defaults.rules[key]),
    ])),
    windows: Object.fromEntries(WINDOW_TYPES.map((key) => [
      key,
      normalizeWeek(pref.windows?.[key], defaults.windows[key]),
    ])),
  };
};

export const getPreferences = async (userId) => {
  const result = await query(`
    SELECT u.first_name, p.allow_next_week, p.persist_meals, p.skip_not_signed_up
    FROM users u
    LEFT JOIN user_preferences p ON p.user_id = u.id
    WHERE u.id = $1
  `, [userId]);
  const row = result.rows[0];
  if (!row) return null;
  return {
    firstName: row.first_name,
    preferences: {
      allowNextWeek: row.allow_next_week ?? false,
      persistMeals: row.persist_meals ?? false,
      skipNotSignedUp: row.skip_not_signed_up ?? false,
    },
  };
};

export const updatePreferences = async (userId, pref, { isAdmin }) => {
  const current = await getPreferences(userId);
  const next = {
    allowNextWeek: pref.allowNextWeek,
    persistMeals: isAdmin ? pref.persistMeals : current?.preferences.persistMeals ?? false,
    skipNotSignedUp: isAdmin ? pref.skipNotSignedUp : current?.preferences.skipNotSignedUp ?? false,
  };
  await query(`
    INSERT INTO user_preferences (user_id, allow_next_week, persist_meals, skip_not_signed_up)
    VALUES ($1,$2,$3,$4)
    ON CONFLICT (user_id) DO UPDATE SET
      allow_next_week = EXCLUDED.allow_next_week,
      persist_meals = EXCLUDED.persist_meals,
      skip_not_signed_up = EXCLUDED.skip_not_signed_up,
      updated_at = NOW()
  `, [userId, next.allowNextWeek, next.persistMeals, next.skipNotSignedUp]);
  return getPreferences(userId);
};

export const getNotifications = async (userId) => {
  const defaults = cloneDefaults();
  const [base, rules, windows, devices] = await Promise.all([
    query(`
    SELECT u.first_name, n.email_enabled, n.push_enabled
    FROM users u
    LEFT JOIN notification_preferences n ON n.user_id = u.id
    WHERE u.id = $1
  `, [userId]),
    query("SELECT rule_type, day_of_week, enabled FROM notification_rules WHERE user_id = $1", [userId]),
    query("SELECT window, day_of_week, enabled FROM notification_windows WHERE user_id = $1", [userId]),
    query(`
      SELECT device_name, expo_push_token, platform
      FROM notification_devices
      WHERE user_id = $1 AND active = TRUE
      ORDER BY updated_at DESC
      LIMIT 1
    `, [userId]),
  ]);
  const row = base.rows[0];
  if (!row) return null;
  return {
    firstName: row.first_name,
    notifications: {
      emailEnabled: row.email_enabled ?? defaults.emailEnabled,
      pushEnabled: row.push_enabled ?? defaults.pushEnabled,
      rules: rowsToWeeks(rules.rows, "rule_type", Object.keys(RULE_TYPES), defaults.rules),
      windows: rowsToWeeks(windows.rows, "window", WINDOW_TYPES, defaults.windows),
      device: devices.rows[0]
        ? {
            name: devices.rows[0].device_name,
            token: devices.rows[0].expo_push_token,
            platform: devices.rows[0].platform,
          }
        : null,
    },
  };
};

export const updateNotifications = async (userId, pref) => {
  const next = normalizeNotifications(pref);
  await query(`
    INSERT INTO notification_preferences (user_id, email_enabled, push_enabled)
    VALUES ($1,$2,$3)
    ON CONFLICT (user_id) DO UPDATE SET
      email_enabled = EXCLUDED.email_enabled,
      push_enabled = EXCLUDED.push_enabled,
      updated_at = NOW()
  `, [userId, next.emailEnabled, next.pushEnabled]);

  await Promise.all([
    query("DELETE FROM notification_rules WHERE user_id = $1", [userId]),
    query("DELETE FROM notification_windows WHERE user_id = $1", [userId]),
  ]);

  for (const [key, dbKey] of Object.entries(RULE_TYPES)) {
    for (let day = 0; day < 7; day += 1) {
      await query(`
        INSERT INTO notification_rules (user_id, rule_type, day_of_week, enabled)
        VALUES ($1,$2,$3,$4)
      `, [userId, dbKey, day, next.rules[key][day]]);
    }
  }

  for (const key of WINDOW_TYPES) {
    for (let day = 0; day < 7; day += 1) {
      await query(`
        INSERT INTO notification_windows (user_id, window, day_of_week, enabled)
        VALUES ($1,$2,$3,$4)
      `, [userId, key, day, next.windows[key][day]]);
    }
  }

  return getNotifications(userId);
};

export const updateNotificationDevice = async (userId, device) => {
  if (!device?.token) return getNotifications(userId);
  await query("UPDATE notification_devices SET active = FALSE, updated_at = NOW() WHERE user_id = $1", [userId]);
  await query(`
    INSERT INTO notification_devices (user_id, device_name, expo_push_token, platform, active)
    VALUES ($1,$2,$3,$4,TRUE)
  `, [userId, device.name || null, device.token, device.platform || null]);
  return getNotifications(userId);
};
