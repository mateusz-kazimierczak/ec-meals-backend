import moment from "moment-timezone";
import {
  isBeforeUpdateTime,
  todayDate,
} from "../_helpers/time.js";
import { getSetting } from "../_helpers/settings.js";
import { findUserById, listUsers } from "../data/users.js";
import { findActivityByMailchimpId } from "../data/activities.js";
import { getCurrentMealEntries, getUserLegacyMatrix } from "../data/mealStore.js";
import { query } from "../db/index.js";
import { torontoDateKey } from "../domain/meals.js";

const getUserMeals = async (forUser) => {
  const matrix = await getUserLegacyMatrix(forUser);
  const todayIndex = moment().tz("America/Toronto").isoWeekday() - 1;
  const tomorrowIndex = (todayIndex + 1) % 7;
  return [matrix[todayIndex], matrix[tomorrowIndex]];
};

const getAllUsersBreakfast = async (dayIndex) => {
  const users = await listUsers({ activeOnly: true });
  const rows = await Promise.all(users.map(async (user) => ({
    user,
    meals: await getUserLegacyMatrix(user.id),
  })));
  return rows
    .filter(({ meals }) => meals?.[dayIndex]?.[0])
    .map(({ user }) => ({ name: `${user.firstName} ${user.lastName}`, id: user.id, diet: user.diet }));
};

export default async function homeRoutes(app) {
  app.get("/api/home/meals", async (request) => {
    const [allMealsToday, tomorrowMeals] = await getUserMeals(request.user.id);
    return { allMealsToday, tomorrowMeals };
  });

  app.get("/api/home/birthdays", async () => {
    const acceptableMonths = [moment().month() + 1, moment().add(1, "months").month() + 1];
    const birthdayUsers = (await listUsers({ activeOnly: true }))
      .filter((user) => acceptableMonths.includes(user.birthdayMonth));

    const birthdayDisplay = birthdayUsers
      .map((user) => {
        const birthdayDate = moment().tz("America/Toronto").month(user.birthdayMonth - 1).date(user.birthdayDay);
        return {
          name: `${user.firstName} ${user.lastName}`,
          days: birthdayDate.diff(moment().tz("America/Toronto").startOf("day"), "days"),
          id: user.id,
        };
      })
      .filter((user) => user.days >= 0)
      .sort((a, b) => a.days - b.days);

    return { birthdayDisplay };
  });

  app.get("/api/home/current_meals", async (request, reply) => {
    const scheduleSetting = await getSetting("schedule");
    const currentTime = new Date();
    const timeToronto = moment(currentTime).tz("America/Toronto");
    const currHour = timeToronto.hour();

    if (isBeforeUpdateTime(currentTime, scheduleSetting)) {
      const [, todayIndex] = todayDate();
      return { meal: "Breakfast", meals: await getAllUsersBreakfast(todayIndex) };
    }

    const todayKey = torontoDateKey();
    if (currHour < 9) return { meal: "Breakfast", meals: await getCurrentMealEntries(todayKey, "breakfast"), currHour };
    if (currHour < 14) return { meal: "Lunch", meals: await getCurrentMealEntries(todayKey, "lunch"), currHour };
    return { meal: "Supper", meals: await getCurrentMealEntries(todayKey, "dinner"), currHour, currDate: new Date() };
  });

  app.get("/api/home/current-activity", async (request) => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const result = await query(`
      SELECT mailchimp_id
      FROM activities
      WHERE send_time <= $1 AND activity_date >= $2
      ORDER BY activity_date ASC
      LIMIT 1
    `, [now, startOfToday]);
    const activity = result.rows[0] && await findActivityByMailchimpId(result.rows[0].mailchimp_id);

    if (!activity) return { activity: null };

    const user = await findUserById(request.user.id);
    const body = (activity.body || "").replace(/\*\|FNAME\|\*/g, user?.firstName || "there");
    return {
      activity: {
        title: activity.title,
        activityName: activity.activityName,
        activityDate: activity.activityDate,
        sendTime: activity.sendTime,
        body,
      },
    };
  });
}
