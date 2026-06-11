import mongoose from "mongoose";
import moment from "moment-timezone";
import connectDB from "../_helpers/db/connect.js";
import User from "../_helpers/db/models/User.js";
import Day from "../_helpers/db/models/Day.js";
import {
  dayString,
  getAppDayIndex,
  isAfterNDays,
  isDayPast,
  isNowPastUpdateTime,
  isToday,
  isTodayAndAfterUpdateTime,
  isWithinAWeek,
  reconstructDate,
  withUpdateTime,
} from "../_helpers/time.js";
import { getSetting } from "../_helpers/settings.js";

const meals = ["Breakfast", "Lunch", "Dinner", "P1", "P2", "PS"];

const mealUser = (user) => ({
  name: `${user.firstName} ${user.lastName}`,
  _id: user._id,
  diet: user.diet,
});

const buildMealArraysFromDay = (day) => ({
  meals: day?.meals || [[], [], []],
  packedMeals: day?.packedMeals || [[], [], []],
  noMeals: day?.noMeals || [],
  unmarked: [],
});

const addGuests = (day, allMeals) => {
  day?.guests?.forEach((guest) => {
    const target = guest.meal < 3 ? allMeals.meals[guest.meal] : allMeals.packedMeals[guest.meal - 3];
    target.push({ name: guest.name, diet: guest.diet, _id: `_GUEST_${guest.name}` });
  });
};

const addMealsFromUserMatrix = (date, users, mealArrs, getPackedMeals = true, getNormalMeals = true) => {
  const dateIndex = getAppDayIndex(date);

  users.forEach((user) => {
    if (!user.meals) return;
    if (user.meals[dateIndex][6]) {
      mealArrs.noMeals.push(mealUser(user));
      return;
    }
    user.meals[dateIndex].forEach((meal, index) => {
      if (!meal) return;
      if (index < 3 && getNormalMeals) {
        if (!mealArrs.meals[index].find((element) => element._id.toString() === user._id.toString())) {
          mealArrs.meals[index].push(mealUser(user));
        }
      } else if (getPackedMeals) {
        if (!mealArrs.packedMeals[index - 3].find((element) => element._id.toString() === user._id.toString())) {
          mealArrs.packedMeals[index - 3].push(mealUser(user));
        }
      }
    });
  });
};

const checkUnmarkedUsers = (users, mealArrs) => {
  const allMeals = mealArrs.meals.concat(mealArrs.packedMeals).concat([mealArrs.noMeals]);
  users.forEach((user) => {
    const isMarked = allMeals.some((meal) => meal.find((element) => element._id.toString() === user._id.toString()));
    if (!isMarked) mealArrs.unmarked.push(mealUser(user));
  });
};

const ensureDayShape = (day, date) => {
  if (!day) {
    return new Day({ date, meals: [[], [], []], packedMeals: [[], [], []], guests: [], noMeals: [], unmarked: [] });
  }
  if (!day.meals) day.meals = [[], [], []];
  if (!day.packedMeals) day.packedMeals = [[], [], []];
  if (!day.guests) day.guests = [];
  if (!day.noMeals) day.noMeals = [];
  if (!day.unmarked) day.unmarked = [];
  return day;
};

export default async function dayRoutes(app) {
  app.post("/api/day", async (request) => {
    const [body] = await Promise.all([Promise.resolve(request.body || {}), connectDB()]);
    const [day, users, scheduleSetting] = await Promise.all([
      Day.findOne({ date: body.date }),
      User.find({ active: true }, "active firstName lastName meals preferences diet skipNotSignedUp"),
      getSetting("schedule"),
    ]);

    const date = withUpdateTime(moment(reconstructDate(body.date)), scheduleSetting);

    if (date > new Date()) {
      const mealArrs = buildMealArraysFromDay(day);
      if (isWithinAWeek(date)) {
        const getPackedMeals = isNowPastUpdateTime(scheduleSetting) ? isAfterNDays(date, 1) : isAfterNDays(date, 0);
        addMealsFromUserMatrix(date, users, mealArrs, getPackedMeals);
      }
      checkUnmarkedUsers(users, mealArrs);
      const allMeals = {
        meals: mealArrs.meals,
        packedMeals: mealArrs.packedMeals,
        noMeals: mealArrs.noMeals,
        unmarked: mealArrs.unmarked,
      };
      addGuests(day, allMeals);
      return { meals: allMeals, allUsers: users, status: "prediction" };
    }

    if (!day) return { meals: { error: "Day not found" } };

    const allMeals = {
      meals: day.meals || [[], [], []],
      packedMeals: day.packedMeals || [[], [], []],
      noMeals: day.noMeals,
      unmarked: day.unmarked,
    };
    addGuests(day, allMeals);

    return {
      meals: allMeals,
      allUsers: users.filter((user) => user.active && !user.preferences.skipNotSignedUp),
      status: "final",
    };
  });

  app.patch("/api/day", async (request) => {
    const [body] = await Promise.all([Promise.resolve(request.body || {}), connectDB()]);
    const scheduleSetting = await getSetting("schedule");
    let [day, users] = await Promise.all([
      Day.findOne({ date: body.date }),
      body.users && User.find({ _id: { $in: body.users.map((user) => new mongoose.Types.ObjectId(user)) } }, "firstName lastName diet _id"),
    ]);

    day = ensureDayShape(day, body.date);

    if (body.guest) {
      day.guests.push({ meal: body.meal, name: body.guest.name, diet: body.guest.diet });
      day.markModified("guests");
      await day.save();
      return { code: "ok" };
    }

    const mealsIndex = meals.indexOf(body.meal);
    await Promise.all((users || []).map(async (user) => {
      if (mealsIndex < 3) {
        const existing = day.meals[mealsIndex].find((element) => element._id.toString() === user._id.toString());
        if (existing) return;
        if (isWithinAWeek(reconstructDate(body.date)) && !(isToday(reconstructDate(body.date)) && isNowPastUpdateTime(scheduleSetting))) {
          const userObject = await User.findById(user._id);
          userObject.meals[getAppDayIndex(reconstructDate(body.date))][mealsIndex] = true;
          userObject.markModified("meals");
          await userObject.save();
        } else {
          day.meals[mealsIndex].push({ _id: user._id, diet: user.diet, name: `${user.firstName} ${user.lastName}` });
        }
      } else {
        const date = reconstructDate(body.date);
        const addToMatrix = !isDayPast(date) && isWithinAWeek(date)
          && (isNowPastUpdateTime(scheduleSetting) ? isAfterNDays(date, 1) : isAfterNDays(date, 0));
        if (addToMatrix) {
          const userObject = await User.findById(user._id);
          userObject.meals[getAppDayIndex(date)][mealsIndex] = true;
          userObject.markModified("meals");
          await userObject.save();
        } else {
          day.packedMeals[mealsIndex - 3].push({ _id: user._id, diet: user.diet, name: `${user.firstName} ${user.lastName}` });
        }
      }
    }));

    day.noMeals = day.noMeals.filter((element) => !body.users.includes(element._id.toString()));
    day.unmarked = day.unmarked.filter((element) => !body.users.includes(element._id.toString()));
    day.markModified("meals");
    day.markModified("packedMeals");
    day.markModified("noMeals");
    day.markModified("unmarked");
    await day.save();
    return { code: "ok" };
  });

  app.post("/api/day/removeUser", async (request) => {
    const [body, scheduleSetting] = await Promise.all([Promise.resolve(request.body || {}), getSetting("schedule"), connectDB()]);
    const day = reconstructDate(body.date);
    const today = moment().tz("America/Toronto");
    day.set({ hour: today.hour(), minute: today.minute() });

    const dayObject = await Day.findOne({ date: dayString(day) });
    if (body.userID.startsWith("_GUEST_")) {
      const guestName = body.userID.split("_GUEST_")[1];
      const guestIndex = dayObject.guests.findIndex((guest) => guest.name === guestName);
      if (guestIndex !== -1) dayObject.guests.splice(guestIndex, 1);
      await Day.findByIdAndUpdate(dayObject._id, { guests: dayObject.guests });
    } else {
      if (dayObject?.meals) {
        const normalMeals = dayObject.meals;
        const userIndex = normalMeals[body.mealID].findIndex((user) => user._id == body.userID);
        if (userIndex !== -1) normalMeals[body.mealID].splice(userIndex, 1);
        await Day.findByIdAndUpdate(dayObject._id, { meals: normalMeals });
      }

      if (!isTodayAndAfterUpdateTime(day, scheduleSetting)) {
        const user = await User.findById(body.userID);
        if (user) {
          user.meals[getAppDayIndex(day)][body.mealID] = false;
          await User.findByIdAndUpdate(body.userID, { meals: user.meals });
        }
      }
    }

    return { success: true };
  });
}
