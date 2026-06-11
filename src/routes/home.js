import moment from "moment-timezone";
import connectDB from "../_helpers/db/connect.js";
import User from "../_helpers/db/models/User.js";
import Day from "../_helpers/db/models/Day.js";
import Activity from "../_helpers/db/models/Activity.js";
import {
  dayString,
  getNextUpdateTime,
  isBeforeUpdateTime,
  todayDate,
} from "../_helpers/time.js";
import { getSetting } from "../_helpers/settings.js";

const getMealsFromDayObject = (forUser, day, mealType) => (
  day?.[mealType]
    ? day[mealType].map((userArr) => userArr.some((user) => user._id?.toString() === forUser))
    : [false, false, false]
);

const getUserMeals = async (forUser) => {
  const scheduleSetting = await getSetting("schedule");
  const currentTime = new Date();
  const timeToronto = moment(currentTime).tz("America/Toronto");
  const tomorrowToronto = timeToronto.clone().add(1, "day");

  if (!isBeforeUpdateTime(currentTime, scheduleSetting)) {
    const [today, thisUser, tomorrow] = await Promise.all([
      Day.findOne({ date: timeToronto.format("D/M/YYYY") }, "meals packedMeals"),
      User.findById(forUser, "meals"),
      Day.findOne({ date: tomorrowToronto.format("D/M/YYYY") }, "packedMeals"),
    ]);

    if (!today?.meals || !thisUser?.meals) return [null, null];

    const todayMeals = getMealsFromDayObject(forUser, today, "meals")
      .concat(getMealsFromDayObject(forUser, today, "packedMeals"));
    const tomorrowMeals = thisUser.meals[tomorrowToronto.isoWeekday() - 1]
      .slice(0, 3)
      .concat(getMealsFromDayObject(forUser, tomorrow, "packedMeals"));
    return [todayMeals, tomorrowMeals];
  }

  const [thisUser, today] = await Promise.all([
    User.findById(forUser, "meals"),
    Day.findOne({ date: timeToronto.format("D/M/YYYY") }, "packedMeals"),
  ]);

  if (!thisUser?.meals) return [null, null];

  const todayMeals = thisUser.meals[timeToronto.isoWeekday() - 1]
    .slice(0, 3)
    .concat(getMealsFromDayObject(forUser, today, "packedMeals"));
  const tomorrowMeals = thisUser.meals[tomorrowToronto.isoWeekday() - 1];
  return [todayMeals, tomorrowMeals];
};

const getAllUsersBreakfast = async (dayIndex) => {
  const users = await User.find({ active: true });
  return users
    .filter((user) => user.meals?.[dayIndex]?.[0])
    .map((user) => ({ name: `${user.firstName} ${user.lastName}`, id: user._id, diet: user.diet }));
};

export default async function homeRoutes(app) {
  app.get("/api/home/meals", async (request) => {
    await connectDB();
    const [allMealsToday, tomorrowMeals] = await getUserMeals(request.user.id);
    return { allMealsToday, tomorrowMeals };
  });

  app.get("/api/home/birthdays", async () => {
    await connectDB();
    const acceptableMonths = [moment().month(), moment().add(1, "months").month()];
    const birthdayUsers = await User.find(
      { active: true, birthdayMonth: { $in: acceptableMonths } },
      "firstName lastName birthdayMonth birthdayDay",
    );

    const birthdayDisplay = birthdayUsers
      .map((user) => {
        const birthdayDate = moment().tz("America/Toronto").month(user.birthdayMonth - 1).date(user.birthdayDay);
        return {
          name: `${user.firstName} ${user.lastName}`,
          days: birthdayDate.diff(moment().tz("America/Toronto").startOf("day"), "days"),
          id: user._id,
        };
      })
      .filter((user) => user.days >= 0)
      .sort((a, b) => a.days - b.days);

    return { birthdayDisplay };
  });

  app.get("/api/home/current_meals", async (request, reply) => {
    await connectDB();
    const scheduleSetting = await getSetting("schedule");
    const currentTime = new Date();
    const timeToronto = moment(currentTime).tz("America/Toronto");
    const currHour = timeToronto.hour();

    if (isBeforeUpdateTime(currentTime, scheduleSetting)) {
      const [, todayIndex] = todayDate();
      return { meal: "Breakfast", meals: await getAllUsersBreakfast(todayIndex) };
    }

    const [dateToday] = todayDate();
    const todayObject = await Day.findOne({ date: dayString(dateToday) }, "meals");
    if (!todayObject) return reply.code(404).send({ message: "No meals found for today" });

    if (currHour < 9) return { meal: "Breakfast", meals: todayObject.meals[0], currHour };
    if (currHour < 14) return { meal: "Lunch", meals: todayObject.meals[1], currHour };
    return { meal: "Supper", meals: todayObject.meals[2], currHour, currDate: new Date() };
  });

  app.get("/api/home/current-activity", async (request) => {
    await connectDB();

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const activity = await Activity.findOne({
      sendTime: { $lte: now },
      activityDate: { $gte: startOfToday },
    }).sort({ activityDate: 1 }).lean();

    if (!activity) return { activity: null };

    const user = await User.findById(request.user.id).select("firstName").lean();
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
