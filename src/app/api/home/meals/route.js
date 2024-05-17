import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";
import Day from "@/_helpers/db/models/Day";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req, res) {
  await connectDB();

  const forUser = req.headers.get("userID");

  const updateTimeToday = new Date();
  updateTimeToday.setHours(
    parseInt(process.env.UPDATE_TIME.slice(0, 2)),
    parseInt(process.env.UPDATE_TIME.slice(2)),
    0,
    0
  );

  const todayDate = new Date();

  if (todayDate < updateTimeToday) {
    todayDate.setDate(todayDate.getDate() - 1);
  }
  const dayIndex = (todayDate.getDay() - 1) % 7;

  const todayString = `${todayDate.getDate()}/${
    todayDate.getMonth() + 1
  }/${todayDate.getFullYear()}`;

  const [thisUser, today] = await Promise.all([
    User.findById(forUser, "meals firstName"),
    Day.findOne({ date: todayString }, "meals packedMeals"),
  ]);

  const nextDay = new Date();
  nextDay.setDate(nextDay.getDate() + 1);
  const nextDayIndex = (nextDay.getDay() - 1) % 7;

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
