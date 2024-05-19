import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";
import Day from "@/_helpers/db/models/Day";

import {
  todayDate,
  tomorrowDate,
  dayString,
  getNextUpdateTime,
} from "@/_helpers/time";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const getUserMeals = async (forUser) => {
  let todayMeals, tomorrowMeals;
  const [dateToday, todayIndex] = todayDate();
  const [dateTomorrow, nextDayIndex] = tomorrowDate();
  const [nextUpdateTime, disabledDayIndex] = getNextUpdateTime();

  if (nextUpdateTime.getTime() < dateToday.getTime()) {
    console.log("past update time");
    // fetch meals from database
    const [today, thisUser] = await Promise.all([
      Day.findOne({ date: dayString(dateToday) }, "meals packedMeals"),
      User.findById(forUser, "meals"),
    ]);

    const todayNormalMeals = today?.meals
      ? today.meals.map((userArr) => {
          for (let i = 0; i < userArr.length; i++) {
            if (userArr[i]._id.toString() == forUser) {
              return true;
            }
          }
          return false;
        })
      : [false, false, false];

    const todayPackedMeals = today?.packedMeals
      ? today.packedMeals.map((userArr) => {
          for (let i = 0; i < userArr.length; i++) {
            if (userArr[i]._id.toString() == forUser) {
              return true;
            }
          }
          return false;
        })
      : [false, false, false];

    todayMeals = todayNormalMeals.concat(todayPackedMeals);

    tomorrowMeals = thisUser.meals[nextDayIndex];
  } else {
    // fetch meals from user object

    const thisUser = await User.findById(forUser, "meals");
    todayMeals = thisUser.meals[todayIndex].slice(0, 3); // only get normal meals,
    // TODO: fetch packed meals from db
    tomorrowMeals = thisUser.meals[nextDayIndex];
  }

  return [todayMeals, tomorrowMeals];
};

export async function GET(req, res) {
  await connectDB();

  const forUser = req.headers.get("userID");

  const [allMealsToday, tomorrowMeals] = await getUserMeals(forUser);

  return Response.json({
    allMealsToday,
    tomorrowMeals,
  });
}
