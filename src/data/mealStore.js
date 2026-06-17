import moment from "moment-timezone";
import { query } from "../db/index.js";
import {
  ALL_MEAL_TYPES,
  dateKeyFromLegacy,
  dateKeysForWeek,
  emptyLegacyMatrix,
  mealEntry,
  mealTypeIndex,
  NORMAL_MEAL_TYPES,
  PACKED_MEAL_TYPES,
  torontoDateKey,
} from "../domain/meals.js";

const mapService = (row) => row && ({
  id: row.id,
  date: row.service_date instanceof Date ? torontoDateKey(row.service_date) : String(row.service_date),
  mealType: row.meal_type,
  status: row.status,
  cutoffAt: row.cutoff_at,
});

export const ensureMealServicesForDate = async (dateKey) => {
  const rows = [];
  for (const mealType of ALL_MEAL_TYPES) {
    const result = await query(`
      INSERT INTO meal_services (service_date, meal_type)
      VALUES ($1::date, $2)
      ON CONFLICT (service_date, meal_type) DO UPDATE SET updated_at = NOW()
      RETURNING *
    `, [dateKey, mealType]);
    rows.push(mapService(result.rows[0]));
  }
  return rows;
};

export const ensureMealServicesForRange = async (fromKey, toKey) => {
  const start = moment.tz(fromKey, "YYYY-MM-DD", "America/Toronto");
  const end = moment.tz(toKey, "YYYY-MM-DD", "America/Toronto");
  const services = [];
  for (const date = start.clone(); date.isSameOrBefore(end, "day"); date.add(1, "day")) {
    services.push(...await ensureMealServicesForDate(date.format("YYYY-MM-DD")));
  }
  return services;
};

export const getMealServicesForDate = async (dateKey) => {
  await ensureMealServicesForDate(dateKey);
  const result = await query("SELECT * FROM meal_services WHERE service_date = $1::date ORDER BY meal_type", [dateKey]);
  return result.rows.map(mapService);
};

export const getUserLegacyMatrix = async (userId, start = moment().tz("America/Toronto").startOf("isoWeek")) => {
  const dateKeys = dateKeysForWeek(start);
  await ensureMealServicesForRange(dateKeys[0], dateKeys[6]);
  const matrix = emptyLegacyMatrix();
  const result = await query(`
    SELECT ms.service_date::text, ms.meal_type, s.status, dnm.user_id IS NOT NULL AS no_meals
    FROM meal_services ms
    LEFT JOIN meal_signups s ON s.meal_service_id = ms.id AND s.user_id = $1
    LEFT JOIN daily_no_meals dnm ON dnm.service_date = ms.service_date AND dnm.user_id = $1
    WHERE ms.service_date BETWEEN $2::date AND $3::date
  `, [userId, dateKeys[0], dateKeys[6]]);

  for (const row of result.rows) {
    const dayIndex = dateKeys.indexOf(row.service_date);
    if (dayIndex === -1) continue;
    if (row.no_meals) {
      matrix[dayIndex][6] = true;
      continue;
    }
    const index = mealTypeIndex(row.meal_type);
    if (index !== -1) matrix[dayIndex][index] = row.status === "attending";
  }
  return matrix;
};

export const setUserLegacyMatrix = async (userId, matrix, { actorId = userId, source = "user", start = moment().tz("America/Toronto").startOf("isoWeek") } = {}) => {
  const dateKeys = dateKeysForWeek(start);
  await ensureMealServicesForRange(dateKeys[0], dateKeys[6]);

  for (let dayIndex = 0; dayIndex < dateKeys.length; dayIndex += 1) {
    const dateKey = dateKeys[dayIndex];
    const day = matrix[dayIndex] || [];
    if (day[6]) {
      await query(`
        INSERT INTO daily_no_meals (user_id, service_date, source, updated_by)
        VALUES ($1, $2::date, $3, $4)
        ON CONFLICT (user_id, service_date) DO UPDATE SET source = EXCLUDED.source, updated_by = EXCLUDED.updated_by, updated_at = NOW()
      `, [userId, dateKey, source, actorId]);
    } else {
      await query("DELETE FROM daily_no_meals WHERE user_id = $1 AND service_date = $2::date", [userId, dateKey]);
    }

    for (let mealIndex = 0; mealIndex < ALL_MEAL_TYPES.length; mealIndex += 1) {
      const mealType = ALL_MEAL_TYPES[mealIndex];
      const status = day[mealIndex] ? "attending" : "unmarked";
      await query(`
        INSERT INTO meal_signups (user_id, meal_service_id, status, source, updated_by)
        SELECT $1, id, $2, $3, $4
        FROM meal_services
        WHERE service_date = $5::date AND meal_type = $6
        ON CONFLICT (user_id, meal_service_id) DO UPDATE SET
          status = EXCLUDED.status,
          source = EXCLUDED.source,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
      `, [userId, status, source, actorId, dateKey, mealType]);
    }
  }
};

export const setMealSignup = async ({ userId, date, mealType, status = "attending", actorId = null, source = "admin" }) => {
  const dateKey = dateKeyFromLegacy(date);
  await ensureMealServicesForDate(dateKey);
  if (status === "attending") {
    await query("DELETE FROM daily_no_meals WHERE user_id = $1 AND service_date = $2::date", [userId, dateKey]);
  }
  await query(`
    INSERT INTO meal_signups (user_id, meal_service_id, status, source, updated_by)
    SELECT $1, id, $2, $3, $4
    FROM meal_services
    WHERE service_date = $5::date AND meal_type = $6
    ON CONFLICT (user_id, meal_service_id) DO UPDATE SET
      status = EXCLUDED.status,
      source = EXCLUDED.source,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
  `, [userId, status, source, actorId, dateKey, mealType]);
};

export const setNoMeals = async ({ userId, date, enabled = true, actorId = null, source = "admin" }) => {
  const dateKey = dateKeyFromLegacy(date);
  await ensureMealServicesForDate(dateKey);
  if (enabled) {
    await query(`
      INSERT INTO daily_no_meals (user_id, service_date, source, updated_by)
      VALUES ($1, $2::date, $3, $4)
      ON CONFLICT (user_id, service_date) DO UPDATE SET source = EXCLUDED.source, updated_by = EXCLUDED.updated_by, updated_at = NOW()
    `, [userId, dateKey, source, actorId]);
    await query(`
      UPDATE meal_signups s
      SET status = 'unmarked', source = $3, updated_by = $4, updated_at = NOW()
      FROM meal_services ms
      WHERE s.meal_service_id = ms.id AND s.user_id = $1 AND ms.service_date = $2::date
    `, [userId, dateKey, source, actorId]);
  } else {
    await query("DELETE FROM daily_no_meals WHERE user_id = $1 AND service_date = $2::date", [userId, dateKey]);
  }
};

export const addGuestSignup = async ({ date, mealType, guest, actorId }) => {
  const dateKey = dateKeyFromLegacy(date);
  await ensureMealServicesForDate(dateKey);
  await query(`
    INSERT INTO guest_signups (meal_service_id, name, diet, created_by)
    SELECT id, $1, $2, $3
    FROM meal_services
    WHERE service_date = $4::date AND meal_type = $5
  `, [guest.name, guest.diet || null, actorId, dateKey, mealType]);
};

export const getGuestsForDate = async (date) => {
  const dateKey = dateKeyFromLegacy(date);
  const result = await query(`
    SELECT ms.meal_type, g.name, g.diet
    FROM guest_signups g
    JOIN meal_services ms ON ms.id = g.meal_service_id
    WHERE ms.service_date = $1::date
    ORDER BY g.created_at
  `, [dateKey]);
  return result.rows.map((row) => ({
    meal: mealTypeIndex(row.meal_type),
    name: row.name,
    diet: row.diet,
  }));
};

export const removeGuestByName = async ({ date, mealType, name }) => {
  const dateKey = dateKeyFromLegacy(date);
  await query(`
    DELETE FROM guest_signups g
    USING meal_services ms
    WHERE g.meal_service_id = ms.id
      AND ms.service_date = $1::date
      AND ms.meal_type = $2
      AND g.name = $3
  `, [dateKey, mealType, name]);
};

export const getDaySummary = async (date) => {
  const dateKey = dateKeyFromLegacy(date);
  await ensureMealServicesForDate(dateKey);
  const [signups, noMeals, guests, users] = await Promise.all([
    query(`
      SELECT ms.meal_type, u.id, u.first_name, u.last_name, d.name AS diet
      FROM meal_services ms
      JOIN meal_signups s ON s.meal_service_id = ms.id AND s.status = 'attending'
      JOIN users u ON u.id = s.user_id
      LEFT JOIN diets d ON d.id = u.diet_id
      WHERE ms.service_date = $1::date AND u.active = TRUE
    `, [dateKey]),
    query(`
      SELECT u.id, u.first_name, u.last_name, d.name AS diet
      FROM daily_no_meals n
      JOIN users u ON u.id = n.user_id
      LEFT JOIN diets d ON d.id = u.diet_id
      WHERE n.service_date = $1::date AND u.active = TRUE
    `, [dateKey]),
    query(`
      SELECT ms.meal_type, g.name, g.diet
      FROM guest_signups g
      JOIN meal_services ms ON ms.id = g.meal_service_id
      WHERE ms.service_date = $1::date
    `, [dateKey]),
    query(`
      SELECT u.id, u.first_name, u.last_name, d.name AS diet, COALESCE(p.skip_not_signed_up, FALSE) AS skip_not_signed_up
      FROM users u
      LEFT JOIN diets d ON d.id = u.diet_id
      LEFT JOIN user_preferences p ON p.user_id = u.id
      WHERE u.active = TRUE
      ORDER BY u.first_name, u.last_name
    `),
  ]);

  const meals = [[], [], []];
  const packedMeals = [[], [], []];
  const marked = new Set();

  for (const row of signups.rows) {
    const entry = mealEntry({ id: row.id, firstName: row.first_name, lastName: row.last_name, diet: row.diet });
    marked.add(row.id);
    const index = mealTypeIndex(row.meal_type);
    if (index < 3) meals[index].push(entry);
    else packedMeals[index - 3].push(entry);
  }

  const noMealEntries = noMeals.rows.map((row) => {
    marked.add(row.id);
    return mealEntry({ id: row.id, firstName: row.first_name, lastName: row.last_name, diet: row.diet });
  });

  for (const row of guests.rows) {
    const index = mealTypeIndex(row.meal_type);
    const target = index < 3 ? meals[index] : packedMeals[index - 3];
    target.push({ name: row.name, diet: row.diet, _id: `_GUEST_${row.name}` });
  }

  const unmarked = users.rows
    .filter((row) => !row.skip_not_signed_up && !marked.has(row.id))
    .map((row) => mealEntry({ id: row.id, firstName: row.first_name, lastName: row.last_name, diet: row.diet }));

  return {
    meals: {
      meals,
      packedMeals,
      noMeals: noMealEntries,
      unmarked,
    },
    allUsers: users.rows
      .filter((row) => !row.skip_not_signed_up)
      .map((row) => ({
        id: row.id,
        _id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        diet: row.diet,
        active: true,
      })),
  };
};

export const getCurrentMealEntries = async (date, mealType) => {
  const summary = await getDaySummary(date);
  const index = mealTypeIndex(mealType);
  return index < 3 ? summary.meals.meals[index] : summary.meals.packedMeals[index - 3];
};

export const removeUserFromMeal = async ({ date, mealType, userId, actorId }) => {
  if (userId.startsWith("_GUEST_")) {
    await removeGuestByName({ date, mealType, name: userId.split("_GUEST_")[1] });
    return;
  }
  await setMealSignup({ userId, date, mealType, status: "unmarked", actorId, source: "admin" });
};

export const getCalendar = async ({ userId, from, to }) => {
  await ensureMealServicesForRange(from, to);
  const result = await query(`
    SELECT ms.id, ms.service_date::text, ms.meal_type, ms.status AS service_status,
           COALESCE(s.status, 'unmarked') AS signup_status,
           dnm.user_id IS NOT NULL AS no_meals
    FROM meal_services ms
    LEFT JOIN meal_signups s ON s.meal_service_id = ms.id AND s.user_id = $1
    LEFT JOIN daily_no_meals dnm ON dnm.service_date = ms.service_date AND dnm.user_id = $1
    WHERE ms.service_date BETWEEN $2::date AND $3::date
    ORDER BY ms.service_date, ms.meal_type
  `, [userId, from, to]);
  return result.rows.map((row) => ({
    mealServiceId: row.id,
    date: row.service_date,
    mealType: row.meal_type,
    status: row.no_meals ? "not_attending" : row.signup_status,
    serviceStatus: row.service_status,
    noMeals: row.no_meals,
  }));
};
