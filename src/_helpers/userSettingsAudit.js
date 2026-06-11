import { query } from "./postgres.js";

const normalizeValue = (value) => {
  if (value === undefined) {
    return null;
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch (err) {
    return String(value);
  }
};

const timestampValue = (value) => ({
  value: value instanceof Date ? value.toISOString() : new Date(value).toISOString(),
});

export const buildAuditRowDiff = (before, after, fields) => {
  const changedFields = [];
  const oldValues = {};
  const newValues = {};

  fields.forEach((field) => {
    const beforeVal = normalizeValue(before?.[field]);
    const afterVal = normalizeValue(after?.[field]);

    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      changedFields.push(field);
      oldValues[field] = beforeVal;
      newValues[field] = afterVal;
    }
  });

  return {
    changedFields,
    oldValues,
    newValues,
  };
};

export const logUserSettingsChange = async ({
  actorUserId,
  actorRole,
  targetUserId,
  changeType,
  changedFields,
  oldValues,
  newValues,
  metadata = {},
  isBatch = false,
  requestPath = null,
  userAgent = null,
}) => {
  if (!targetUserId || !Array.isArray(changedFields) || changedFields.length === 0) {
    return;
  }

  try {
    await query(
      `
        INSERT INTO user_settings_history (
          change_time,
          actor_user_id,
          actor_role,
          target_user_id,
          change_type,
          is_batch,
          changed_fields,
          old_values,
          new_values,
          metadata,
          request_path,
          user_agent
        )
        VALUES (NOW(), $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11)
      `,
      [
        actorUserId || null,
        actorRole || null,
        targetUserId,
        changeType,
        isBatch,
        JSON.stringify(changedFields),
        JSON.stringify(normalizeValue(oldValues)),
        JSON.stringify(normalizeValue(newValues)),
        JSON.stringify(normalizeValue(metadata)),
        requestPath,
        userAgent,
      ],
    );
  } catch (error) {
    console.error("Failed to write user settings audit row:", error.message);
  }
};

export const getUserSettingsAuditRows = async ({
  userId,
  startDate,
  endDate,
}) => {
  const result = await query(
    `
      SELECT
        change_time AS "CHANGE_TIME",
        actor_user_id AS "ACTOR_USER_ID",
        actor_role AS "ACTOR_ROLE",
        target_user_id AS "TARGET_USER_ID",
        change_type AS "CHANGE_TYPE",
        is_batch AS "IS_BATCH",
        changed_fields::text AS "CHANGED_FIELDS",
        old_values::text AS "OLD_VALUES",
        new_values::text AS "NEW_VALUES",
        metadata::text AS "METADATA",
        request_path AS "REQUEST_PATH",
        user_agent AS "USER_AGENT"
      FROM user_settings_history
      WHERE target_user_id = $1
        AND change_time BETWEEN $2::timestamptz AND $3::timestamptz
      ORDER BY change_time DESC
    `,
    [userId, startDate, endDate],
  );

  return result.rows.map((row) => ({
    ...row,
    CHANGE_TIME: timestampValue(row.CHANGE_TIME),
  }));
};
