import jwt from "jsonwebtoken";
import { createUser as createPostgresUser } from "../../src/data/users.js";
import { updateNotificationDevice, updateNotifications, updatePreferences } from "../../src/data/preferences.js";
import { createActivity as createPostgresActivity } from "../../src/data/activities.js";
import {
  addGuestSignup,
  setNoMeals,
  setMealSignup,
  setUserLegacyMatrix,
} from "../../src/data/mealStore.js";
import { ALL_MEAL_TYPES } from "../../src/domain/meals.js";

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
  const user = await createPostgresUser({
    username: username.toLowerCase(),
    password: overrides.password || userPassword,
    firstName: overrides.firstName || "Test",
    lastName: overrides.lastName || "User",
    role: overrides.role || "user",
    email: overrides.email || `${username}@example.com`,
    active: overrides.active ?? true,
    room: overrides.room,
    diet: overrides.diet,
    guest: overrides.guest,
    birthdayDay: overrides.birthdayDay,
    birthdayMonth: overrides.birthdayMonth,
  });

  if (overrides.preferences) await updatePreferences(user.id, overrides.preferences, { isAdmin: true });
  if (overrides.notifications !== undefined) {
    await updateNotifications(user.id, overrides.notifications || {});
    if (overrides.notifications?.device) await updateNotificationDevice(user.id, overrides.notifications.device);
  }
  if (overrides.meals) await setUserLegacyMatrix(user.id, overrides.meals);
  user.meals = overrides.meals || buildMeals();
  user._id = user.id;
  return user;
};

export const seedUsers = async () => {
  const [admin, student, otherStudent, activityEditor] = await Promise.all([
    createUser({ username: "admin", firstName: "Admin", role: "admin" }),
    createUser({ username: "user", firstName: "Student", role: "user" }),
    createUser({ username: "other", firstName: "Other", role: "user" }),
    createUser({ username: "editor", firstName: "Editor", role: "activity_editor" }),
  ]);

  return { admin, student, user: student, otherStudent, activityEditor };
};

export const tokenFor = (user) => jwt.sign(
  { id: user.id || user._id.toString(), role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: "1h" },
);

export const authHeadersFor = (user) => ({ authorization: tokenFor(user) });

export const createDay = async (overrides = {}) => {
  const allMeals = [...(overrides.meals ?? [[], [], []]), ...(overrides.packedMeals ?? [[], [], []])];
  for (let mealIndex = 0; mealIndex < allMeals.length; mealIndex += 1) {
    for (const entry of allMeals[mealIndex]) {
      if (entry._id && !String(entry._id).startsWith("_GUEST_")) {
        await setMealSignup({
          userId: entry._id.toString(),
          date: overrides.date,
          mealType: ALL_MEAL_TYPES[mealIndex],
          status: "attending",
          source: "admin",
        });
      }
    }
  }
  for (const guest of overrides.guests ?? []) {
    await addGuestSignup({
      date: overrides.date,
      mealType: ALL_MEAL_TYPES[guest.meal],
      guest,
      actorId: null,
    });
  }
  for (const entry of overrides.noMeals ?? []) {
    await setNoMeals({
      userId: entry._id.toString(),
      date: overrides.date,
      enabled: true,
      source: "admin",
    });
  }
};

export const createActivity = async (overrides = {}) => createPostgresActivity({
  mailchimpId: overrides.mailchimpId || "campaign-1",
  title: overrides.title || "Activity title",
  activityName: overrides.activityName || "Activity name",
  activityDate: overrides.activityDate || new Date("2026-06-12T22:00:00.000Z"),
  sendTime: overrides.sendTime ?? new Date("2026-06-10T12:00:00.000Z"),
  status: overrides.status || "sent",
  body: overrides.body || "Hello *|FNAME|*",
  emailsSent: overrides.emailsSent ?? 0,
});
