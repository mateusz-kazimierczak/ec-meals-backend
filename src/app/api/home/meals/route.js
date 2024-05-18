import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";
import Day from "@/_helpers/db/models/Day";

import { todayDate, tomorrowDate, dayString } from "@/_helpers/time";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req, res) {
  await connectDB();

  const forUser = req.headers.get("userID");

  const [dateToday, todayIndex] = todayDate();

  const [thisUser, today] = await Promise.all([
    User.findById(forUser, "meals firstName"),
    Day.findOne({ date: dayString(dateToday) }, "meals packedMeals"),
  ]);

  const [dateTomorrow, nextDayIndex] = tomorrowDate();

  const tomorrowMeals = thisUser.meals[nextDayIndex];

  const todayMeals = today.meals
    ? today.meals.map((userArr) => {
        for (let i = 0; i < userArr.length; i++) {
          if (userArr[i]._id.toString() == forUser) {
            return true;
          }
        }
        return false;
      })
    : [false, false, false];

  const todayPackedMeals = today.packedMeals
    ? today.packedMeals.map((userArr) => {
        for (let i = 0; i < userArr.length; i++) {
          if (userArr[i]._id.toString() == forUser) {
            return true;
          }
        }
        return false;
      })
    : [false, false, false];

  const allMealsToday = todayMeals.concat(todayPackedMeals);

  return Response.json({
    allMealsToday,
    tomorrowMeals,
  });
}
