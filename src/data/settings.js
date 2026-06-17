import { query } from "../db/index.js";

export const getSetting = async (key) => {
  const result = await query("SELECT key, value FROM settings WHERE key = $1", [key]);
  const row = result.rows[0];
  return row ? { _id: row.key, ...row.value } : null;
};

export const upsertSetting = async (body) => {
  const { _id, ...value } = body;
  await query(`
    INSERT INTO settings (key, value)
    VALUES ($1, $2::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `, [_id, JSON.stringify(value)]);
  return getSetting(_id);
};
