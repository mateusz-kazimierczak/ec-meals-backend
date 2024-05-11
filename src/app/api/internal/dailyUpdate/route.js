import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";
import Day from "@/_helpers/db/models/Day";
import { NextRequest } from "next/server";
import { sendMealEmails } from "@/_helpers/emails";

export async function GET() {
  // Check that update date is close enough:
  // i

  console.log("Updating meals...");

  await connectDB();

  const todayDate = new Date();
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);

  let dayIndex = (todayDate.getDay() - 1) % 7;
  if (dayIndex === -1) dayIndex = 6;

  let nextDayIndex = tomorrowDate.getDay() - 1;
  if (nextDayIndex === -1) nextDayIndex = 6;

  const TodayString = `${todayDate.getDate()}/${
    todayDate.getMonth() + 1
  }/${todayDate.getFullYear()}`;
  const TomorrowString = `${tomorrowDate.getDate()}/${
    tomorrowDate.getMonth() + 1
  }/${tomorrowDate.getFullYear()}`;

  const [users, days] = await Promise.all([
    User.find(
      { active: true },
      "name meals preferences email firstName lastName diet"
    ),
    Day.find({ date: { $in: [TodayString, TomorrowString] } }),
  ]);

  let today = days.filter((day) => day.date === TodayString)[0];
  let tomorrow = days.filter((day) => day.date === TomorrowString)[0];

  // If the today and yesterday are not in the database, create them
  if (!today) {
    today = new Day({
      date: TodayString,
    });
  }
  if (!tomorrow) {
    tomorrow = new Day({
      date: TomorrowString,
    });
  }

  const meals = MealCategories.slice(0, 3).map((category) => []);
  const packedMeals = MealCategories.slice(3, 6).map((category) => []);
  const noMeals = [];
  const unmarked = [];

  const emails = [];

  users.forEach((user) => {
    if (user.meals[dayIndex][6]) {
      return noMeals.push(constructMealUserObject(user));
    }

    // Check every user
    user.meals[dayIndex].slice(0, 3).forEach((meal, index) => {
      // Check every meal on that day (not packed meals)
      if (meal) {
        meals[index].push(constructMealUserObject(user));
      }
    });

    user.meals[nextDayIndex].slice(3, 6).forEach((meal, index) => {
      // Check every packed meal on that day
      if (meal) {
        packedMeals[index].push(constructMealUserObject(user));
      }
    });

    const mealsToday = user.meals[dayIndex];
    const mealsTomorrow = user.meals[nextDayIndex];

    let markedToday = false;
    for (let i = 0; i < 7; i++) {
      if (mealsToday[i]) {
        markedToday = true;
        break;
      }
    }

    let markedTomorrow = false;
    for (let i = 0; i < 7; i++) {
      if (mealsTomorrow[i]) {
        markedTomorrow = true;
        break;
      }
    }

    if (!markedToday) {
      unmarked.push(constructMealUserObject(user));
    }

    if (
      ((user.preferences.email === 1 && !markedTomorrow) ||
        user.preferences.email === 2) &&
      user.email
    ) {
      emails.push({
        name: user.firstName,
        email: user.email,
        meals: user.meals,
        todayMeals: mealsToday,
        tomorrowMeals: mealsTomorrow,
        warning: !markedTomorrow,
      });
    }
  });

  today.meals = meals;
  tomorrow.packedMeals = packedMeals;
  today.unmarked = unmarked;

  await Promise.all([today.save(), tomorrow.save(), sendMealEmails(emails)]);
  console.log("Meals updated");

  return Response.json({
    message: "OK",
  });
}

const constructMealUserObject = (user) => {
  return {
    name: user.firstName + " " + user.lastName,
    _id: user._id,
    diet: user.diet,
  };
};

const UpdateDateTooFar = () => {
  const today = new Date();

  const nextUpdateTime = new Date();

  nextUpdateTime.setHours(
    parseInt(process.env.UPDATE_TIME.slice(0, 2)),
    parseInt(process.env.UPDATE_TIME.slice(2)),
    0,
    0
  );

  if (Math.abs(today.getTime() - nextUpdateTime.getTime()) < 1000 * 60 * 3) {
    return false;
  }

  return true;
};

const MealCategories = [
  "Breakdfast",
  "Lunch",
  "Supper",
  "P1",
  "P2",
  "PS",
  "No Meals",
  "Unmarked",
];
