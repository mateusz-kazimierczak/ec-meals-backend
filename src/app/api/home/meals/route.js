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

const getMealsFromDayObject = (forUser, day, mealType) => {
  return day?.[mealType]
    ? day[mealType].map((userArr) => {
        for (let i = 0; i < userArr.length; i++) {
          if (userArr[i]._id?.toString() == forUser) {
            return true;
          }
        }
        return false;
      })
    : [false, false, false];
};

const getUserMeals = async (forUser) => {

  let todayMeals, tomorrowMeals;
  const [dateToday, todayIndex] = todayDate();
  const [dateTomorrow, nextDayIndex] = tomorrowDate();

  const todayUpdate = new Date(dateToday);

  todayUpdate.setUTCHours(
    parseInt(process.env.UPDATE_TIME.slice(0, 2)) + 4, // TODO: get this from env variable
    parseInt(process.env.UPDATE_TIME.slice(2)),
    0,
    0
  );

  const utcHour = new Date().getUTCHours();

  if (todayUpdate.getTime() < new Date().getTime() || utcHour < 4) {
    // fetch meals from database
    const [today, thisUser, tomorrow] = await Promise.all([
      Day.findOne({ date: dayString(dateToday) }, "meals packedMeals"), // get meals for today. Both packed and normal
      User.findById(forUser, "meals"), // The user object has normal meals for tomorrow
      Day.findOne({ date: dayString(dateTomorrow) }, "packedMeals"), // For packed meals for tomorrow, you need the day object
    ]);

    console.log("today: ", today);


    if (!today || !today.meals || !thisUser || !thisUser.meals) {
      return [null, null];
    }


    const todayNormalMeals = getMealsFromDayObject(forUser, today, "meals");

    const todayPackedMeals = getMealsFromDayObject(
      forUser,
      today,
      "packedMeals"
    );

    todayMeals = todayNormalMeals.concat(todayPackedMeals);

    if (!tomorrow || !tomorrow.meals) {
      return [todayMeals, null];
    }

    const tomorrowNormalMeals = thisUser.meals[nextDayIndex].slice(0, 3);

    const tomorrowPackedMeals = getMealsFromDayObject(
      forUser,
      tomorrow,
      "packedMeals"
    );

    tomorrowMeals = tomorrowNormalMeals.concat(tomorrowPackedMeals);
  } else {
    // fetch meals from user object

    

    const [thisUser, today] = await Promise.all([
      User.findById(forUser, "meals"),
      Day.findOne({ date: dayString(dateToday) }, "packedMeals"),
    ]);


    if (!thisUser || !thisUser.meals) {
      return [null, null];
    }
    
    todayMeals = thisUser.meals[todayIndex].slice(0, 3); // only get normal meals,
    const todayPackedMeals = getMealsFromDayObject(
      forUser,
      today,
      "packedMeals"
    );

    todayMeals = todayMeals.concat(todayPackedMeals);
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
