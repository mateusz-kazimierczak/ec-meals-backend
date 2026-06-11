import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import initUser from "../../src/_helpers/db/initUser.js";
import Activity from "../../src/_helpers/db/models/Activity.js";
import Day from "../../src/_helpers/db/models/Day.js";
import User from "../../src/_helpers/db/models/User.js";

export const userPassword = "correct-password";

export const buildMeals = () => Array.from({ length: 7 }, () => Array(7).fill(false));

export const formatAppDate = (date) => `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;

export const mealEntryFor = (user) => ({
  _id: user._id,
  name: `${user.firstName} ${user.lastName}`,
  diet: user.diet,
});

export const createUser = async (overrides = {}) => {
  const username = overrides.username || `user-${Date.now()}-${Math.random()}`;
  const user = new User({
    username: username.toLowerCase(),
    hash: await bcrypt.hash(overrides.password || userPassword, 10),
    firstName: overrides.firstName || "Test",
    lastName: overrides.lastName || "User",
    role: overrides.role || "student",
    email: overrides.email || `${username}@example.com`,
    active: overrides.active ?? true,
    room: overrides.room,
    diet: overrides.diet,
    guest: overrides.guest,
    birthdayDay: overrides.birthdayDay,
    birthdayMonth: overrides.birthdayMonth,
  });

  initUser(user);
  if (overrides.meals) user.meals = overrides.meals;
  if (overrides.preferences) user.preferences = overrides.preferences;
  if (overrides.notifications !== undefined) user.notifications = overrides.notifications;

  await user.save();
  return user;
};

export const seedUsers = async () => {
  const [admin, student, otherStudent, activityEditor] = await Promise.all([
    createUser({ username: "admin", firstName: "Admin", role: "admin" }),
    createUser({ username: "student", firstName: "Student", role: "student" }),
    createUser({ username: "other", firstName: "Other", role: "student" }),
    createUser({ username: "editor", firstName: "Editor", role: "activity_editor" }),
  ]);

  return { admin, student, otherStudent, activityEditor };
};

export const tokenFor = (user) => jwt.sign(
  { id: user._id.toString(), role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: "1h" },
);

export const authHeadersFor = (user) => ({ authorization: tokenFor(user) });

export const createDay = async (overrides = {}) => Day.create({
  date: overrides.date,
  meals: overrides.meals ?? [[], [], []],
  packedMeals: overrides.packedMeals ?? [[], [], []],
  noMeals: overrides.noMeals ?? [],
  unmarked: overrides.unmarked ?? [],
  guests: overrides.guests ?? [],
});

export const createActivity = async (overrides = {}) => Activity.create({
  mailchimpId: overrides.mailchimpId || "campaign-1",
  title: overrides.title || "Activity title",
  activityName: overrides.activityName || "Activity name",
  activityDate: overrides.activityDate || new Date("2026-06-12T22:00:00.000Z"),
  sendTime: overrides.sendTime ?? new Date("2026-06-10T12:00:00.000Z"),
  status: overrides.status || "sent",
  body: overrides.body || "Hello *|FNAME|*",
  emailsSent: overrides.emailsSent ?? 0,
});
