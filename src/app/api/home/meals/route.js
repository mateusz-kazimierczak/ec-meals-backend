import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";
import Day from "@/_helpers/db/models/Day";
import moment from "moment-timezone";


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

  // Get update time today
  const current_time = new Date();
  const time_toronto = moment(current_time).tz("America/Toronto");
  const tomorrow_time_toronto = time_toronto.clone().add(1, "day");

  debugger;

  // Set the hour in Toronto time
  let update_time = time_toronto.clone().set({ hour: process.env.UPDATE_TIME.slice(0, 2), minute: process.env.UPDATE_TIME.slice(2) });


  if (current_time > update_time) {
    // After update time today
    // fetch meals from database

    debugger;

    console.log("after update time", current_time, update_time);


    const [today, thisUser, tomorrow] = await Promise.all([
      Day.findOne({ date: time_toronto.format("D/M/YYYY") }, "meals packedMeals"), // get meals for today. Both packed and normal
      User.findById(forUser, "meals"), // The user object has normal meals for tomorrow
      Day.findOne({ date: tomorrow_time_toronto.format("D/M/YYYY") }, "packedMeals"), // For packed meals for tomorrow, you need the day object
    ]);


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

    const tomorrowNormalMeals = thisUser.meals[tomorrow_time_toronto.isoWeekday() - 1].slice(0, 3);

    const tomorrowPackedMeals = getMealsFromDayObject(
      forUser,
      tomorrow,
      "packedMeals"
    );

    tomorrowMeals = tomorrowNormalMeals.concat(tomorrowPackedMeals);
  } else {
    // fetch meals from user object

    debugger;

    console.log("before update time", current_time, update_time);
    

    const [thisUser, today] = await Promise.all([
      User.findById(forUser, "meals"),
      Day.findOne({ date: time_toronto.format("D/M/YYYY") }, "packedMeals"),
    ]);


    if (!thisUser || !thisUser.meals) {
      return [null, null];
    }
    
    todayMeals = thisUser.meals[time_toronto.isoWeekday() - 1].slice(0, 3); // only get normal meals,
    const todayPackedMeals = getMealsFromDayObject(
      forUser,
      today,
      "packedMeals"
    );

    todayMeals = todayMeals.concat(todayPackedMeals);
    tomorrowMeals = thisUser.meals[tomorrow_time_toronto.isoWeekday() - 1];
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
