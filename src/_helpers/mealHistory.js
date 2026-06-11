import { query } from "./postgres.js";

const timestampValue = (value) => ({
  value: value instanceof Date ? value.toISOString() : new Date(value).toISOString(),
});

export const logMealChange = async ({
  userId,
  oldMeals,
  newMeals,
  isSystemChange = false,
}) => {
  if (!userId) return;

  await query(
    `
      INSERT INTO meal_history (
        user_id,
        change_time,
        is_system_change,
        old_meals,
        new_meals
      )
      VALUES ($1, NOW(), $2, $3::jsonb, $4::jsonb)
    `,
    [
      userId,
      isSystemChange,
      JSON.stringify(oldMeals ?? null),
      JSON.stringify(newMeals ?? null),
    ],
  );
};

export const getMealHistoryRows = async ({ userId, startDate, endDate }) => {
  const result = await query(
    `
      SELECT
        user_id AS "USER_ID",
        change_time AS "CHANGE_TIME",
        is_system_change AS "IS_SYSTEM_CHANGE",
        old_meals::text AS "OLD_MEALS",
        new_meals::text AS "NEW_MEALS"
      FROM meal_history
      WHERE user_id = $1
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
