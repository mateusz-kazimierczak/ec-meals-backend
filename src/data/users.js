import bcrypt from "bcryptjs";
import { query } from "../db/index.js";
import { getNotifications, updateNotifications } from "./preferences.js";

const mapPreferences = (preferences) => ({
  allowNextWeek: preferences?.allow_next_week ?? preferences?.allowNextWeek ?? false,
  persistMeals: preferences?.persist_meals ?? preferences?.persistMeals ?? false,
  skipNotSignedUp: preferences?.skip_not_signed_up ?? preferences?.skipNotSignedUp ?? false,
});

const mapUser = async (row) => {
  if (!row) return null;
  const user = {
    id: row.id,
    _id: row.id,
    username: row.username,
    hash: row.hash,
    firstName: row.first_name,
    lastName: row.last_name,
    birthdayMonth: row.birthday_month,
    birthdayDay: row.birthday_day,
    role: row.role,
    email: row.email,
    active: row.active,
    room: row.room,
    guest: row.guest,
    diet: row.diet,
    preferences: mapPreferences(row.preferences),
    notifications: (await getNotifications(row.id))?.notifications,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  delete user.hash;
  return user;
};

const userSelect = `
  u.*,
  d.name AS diet,
  row_to_json(p.*) AS preferences
`;

export const findUserById = async (id, { includeHash = false } = {}) => {
  const result = await query(`
    SELECT ${userSelect}
    FROM users u
    LEFT JOIN diets d ON d.id = u.diet_id
    LEFT JOIN user_preferences p ON p.user_id = u.id
    WHERE u.id = $1
  `, [id]);
  const row = result.rows[0];
  const user = await mapUser(row);
  return includeHash ? { ...user, hash: row?.hash } : user;
};

export const findUserByUsername = async (username, { includeHash = false } = {}) => {
  const result = await query(`
    SELECT ${userSelect}
    FROM users u
    LEFT JOIN diets d ON d.id = u.diet_id
    LEFT JOIN user_preferences p ON p.user_id = u.id
    WHERE u.username = $1
  `, [username]);
  const row = result.rows[0];
  const user = await mapUser(row);
  return includeHash ? { ...user, hash: row?.hash } : user;
};

export const listUsers = async ({ activeOnly = false } = {}) => {
  const result = await query(`
    SELECT ${userSelect}
    FROM users u
    LEFT JOIN diets d ON d.id = u.diet_id
    LEFT JOIN user_preferences p ON p.user_id = u.id
    ${activeOnly ? "WHERE u.active = TRUE" : ""}
    ORDER BY u.first_name, u.last_name, u.username
  `);
  return Promise.all(result.rows.map(mapUser));
};

export const ensureDietId = async (diet) => {
  if (!diet) return null;
  const name = String(diet).toLowerCase().trim();
  if (!name || name === "none") return null;
  const result = await query(`
    INSERT INTO diets (name)
    VALUES ($1)
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id
  `, [name]);
  return result.rows[0].id;
};

const parseBirthday = (birthday) => {
  if (!birthday) return {};
  const [day, month] = birthday.split("/").map((value) => parseInt(value, 10));
  return { birthdayDay: day || null, birthdayMonth: month || null };
};

export const createUser = async (input) => {
  const birthday = input.birthday
    ? parseBirthday(input.birthday)
    : { birthdayDay: input.birthdayDay ?? null, birthdayMonth: input.birthdayMonth ?? null };
  const dietId = await ensureDietId(input.diet);
  const hash = await bcrypt.hash(input.password, 10);
  const result = await query(`
    INSERT INTO users (
      username, hash, first_name, last_name, email, room, role, active, guest,
      birthday_day, birthday_month, diet_id
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING id
  `, [
    input.username?.toLowerCase().trim(),
    hash,
    input.firstName,
    input.lastName || null,
    input.email || null,
    input.room ?? null,
    input.role || "user",
    input.active ?? true,
    input.guest ?? false,
    birthday.birthdayDay ?? null,
    birthday.birthdayMonth ?? null,
    dietId,
  ]);
  const id = result.rows[0].id;
  await query("INSERT INTO user_preferences (user_id) VALUES ($1)", [id]);
  await updateNotifications(id, {});
  return findUserById(id);
};

export const updateUser = async (id, input) => {
  const sets = [];
  const values = [];
  const add = (column, value) => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };

  if (Object.prototype.hasOwnProperty.call(input, "username")) add("username", input.username?.toLowerCase().trim());
  if (Object.prototype.hasOwnProperty.call(input, "firstName")) add("first_name", input.firstName);
  if (Object.prototype.hasOwnProperty.call(input, "lastName")) add("last_name", input.lastName || null);
  if (Object.prototype.hasOwnProperty.call(input, "email")) add("email", input.email || null);
  if (Object.prototype.hasOwnProperty.call(input, "room")) add("room", input.room ?? null);
  if (Object.prototype.hasOwnProperty.call(input, "role")) add("role", input.role);
  if (Object.prototype.hasOwnProperty.call(input, "active")) add("active", input.active);
  if (Object.prototype.hasOwnProperty.call(input, "guest")) add("guest", input.guest ?? false);
  if (Object.prototype.hasOwnProperty.call(input, "diet")) add("diet_id", await ensureDietId(input.diet));
  if (input.birthday) {
    const birthday = parseBirthday(input.birthday);
    add("birthday_day", birthday.birthdayDay ?? null);
    add("birthday_month", birthday.birthdayMonth ?? null);
  }
  if (input.password) add("hash", await bcrypt.hash(input.password, 10));

  if (sets.length > 0) {
    values.push(id);
    await query(`UPDATE users SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${values.length}`, values);
  }
  return findUserById(id);
};

export const deleteUser = async (id) => {
  await query("DELETE FROM users WHERE id = $1", [id]);
};

export const countAdmins = async () => {
  const result = await query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'");
  return result.rows[0].count;
};

export const listDiets = async () => {
  const result = await query("SELECT id, name FROM diets ORDER BY name");
  return result.rows.map((row) => ({ id: row.id, _id: row.id, name: row.name }));
};

export const createDiet = async (name) => {
  const result = await query(
    "INSERT INTO diets (name) VALUES ($1) RETURNING id, name",
    [String(name).toLowerCase().trim()],
  );
  return { id: result.rows[0].id, name: result.rows[0].name };
};

export const deleteDiet = async (id) => {
  await query("DELETE FROM diets WHERE id = $1", [id]);
};
