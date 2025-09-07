import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";
import Day from "@/_helpers/db/models/Day";
import { NextRequest } from "next/server";
import { sendMealEmails } from "@/_helpers/emails";
import { dayString } from "@/_helpers/time";
import next from "next";
import { BigQuery } from "@google-cloud/bigquery";

import moment from "moment-timezone";

import { getAppDayIndex } from "@/_helpers/time";
import { use } from "react";

  const bqClient = new BigQuery(
    {
      projectID: "ec-meals-462913",
      credentials: JSON.parse(process.env.GCP_AUTH || "{}"),

    }
  )

export async function GET() {

  console.log("Updating meals...");

  await connectDB();

  const todayDate = moment().tz("America/Toronto");
  const tomorrowDate = moment().tz("America/Toronto").add(1, "days");

  let dayIndex = getAppDayIndex(todayDate);
  let nextDayIndex = getAppDayIndex(tomorrowDate);

  const TodayString = dayString(todayDate);
  const TomorrowString = dayString(tomorrowDate);

  // Date strings next week
  const now = new Date();
  const NextWeekTodayDate = moment().tz("America/Toronto").add(7, "days");
  const NextWeekTodayString = dayString(NextWeekTodayDate);
  const NextWeekTomorrowDate = moment().tz("America/Toronto").add(8, "days");
  const NextWeekTomorrowString = dayString(NextWeekTomorrowDate);

  const [users, days] = await Promise.all([
    User.find(
      { active: true },
      "name meals preferences email firstName lastName diet"
    ),
    Day.find({ date: { $in: [TodayString, TomorrowString, NextWeekTodayString, NextWeekTomorrowString] } }),
  ]);

  let today = days.filter((day) => day.date === TodayString)[0];
  let tomorrow = days.filter((day) => day.date === TomorrowString)[0];

  let nextWeekToday = days.filter((day) => day.date === NextWeekTodayString)[0];
  let nextWeekTomorrow = days.filter((day) => day.date === NextWeekTomorrowString)[0];

  // If the today and yesterday are not in the database, create them
  if (!today) {
    today = new Day({
      date: TodayString,
      meals: [[], [], []],
      packedMeals: [[], [], []],
      guests: [],
      unmarked: [],

    });
  }
  if (!tomorrow) {
    tomorrow = new Day({
      date: TomorrowString,
      meals: [[], [], []],
      packedMeals: [[], [], []],
      guests: [],
      unmarked: [],
    });
  }

    // user ids of today's packed meals
  let todayPackedMealUserIds = new Set();
  today.packedMeals.forEach((meal) => {
    meal.forEach((userMeal) => {
      todayPackedMealUserIds.add(userMeal._id.toString());
    });
  });

  const meals = MealCategories.slice(0, 3).map((category) => []);
  const packedMeals = MealCategories.slice(3, 6).map((category) => []);
  const noMeals = [];
  const unmarked = [];

  const emails = [];

  const meal_changes = []

  await Promise.all(
    users.map(async (user) => {

      // copy the meals array
      const old_meals = user.meals.map((day) => day.slice());


      if (user.meals[dayIndex][6]) {
        noMeals.push(constructMealUserObject(user));
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

      

      if (nextWeekToday) {
        // check the day object to see if the user has already been marked for a meal
        nextWeekToday.meals.forEach((meal, index) => {
          meal.forEach((userMeal) => {
            if (userMeal._id.toString() === user._id.toString()) {
              nextWeekToday.meals[index].splice(
                nextWeekToday.meals[index].indexOf(userMeal),
                1
              );
              nextWeekToday.markModified("meals");
              user.meals[dayIndex][index] = true;
              return;
            }
          });
        })
      }

      const mealsToday = user.meals[dayIndex];
      const mealsTomorrow = user.meals[nextDayIndex];

      let markedToday = false;
      if (is_user_in_list(user._id, noMeals)) {
        markedToday = true;
      } else {
        // First need to check if the users are not signed up for any normal meals today
        for (let i = 0; i < 3; i++) {
          if (mealsToday[i]) {
            markedToday = true;
            break;
          }
        }

        // Also have to check if they have not signed up for any packed meals today
        if (todayPackedMealUserIds.has(user._id.toString())) {
          markedToday = true;
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

      if (!user.preferences.persistMeals) {
        // remove current meals
        user.meals[dayIndex] = [false, false, false].concat(
          user.meals[dayIndex].slice(3, 6)
        ).concat([false]);

        user.meals[nextDayIndex] = user.meals[nextDayIndex]
          .slice(0, 3)
          .concat([false, false, false]).concat(user.meals[nextDayIndex][6]);

        user.markModified("meals");
      }

      const new_meals = user.meals.map((day) => day.slice());

      const old_json = JSON.stringify(old_meals);
      const new_json = JSON.stringify(new_meals);

      if (old_json !== new_json) {
        meal_changes.push({
      USER_ID: user._id.toString(),
      CHANGE_TIME: now,
      IS_SYSTEM_CHANGE: true,
      OLD_MEALS: old_json,
      NEW_MEALS: new_json,
    })}
      
    })
  );

  const datasetId = "meal_history";
  const tableId = "HISTORY";

  try {
    if (meal_changes.length > 0)
      bqClient.dataset(datasetId).table(tableId).insert(meal_changes);
  } catch (error) {
    console.error("BigQuery insert error:", JSON.stringify(error, null, 2));
  }
  


  addMealsToDays(today, tomorrow, meals, packedMeals, unmarked, noMeals);


  await Promise.all([today.save(), tomorrow.save(),
    saveIfExists(nextWeekToday), saveIfExists(nextWeekTomorrow),
    sendMealEmails(emails),
  ]);

  console.log("Meals updated");

  // Only save the users if the meals have been updated
  await Promise.all(users.map((user) => user.save()));

  return Response.json({
    message: "OK",
  });
}

const is_user_in_list = (id, list) => {
  return list.some((meal) => meal._id.toString() == id.toString());
}

const addMealsToDays = (today, tomorrow, meals, packedMeals, unmarked, noMeals) => {


  if (!today.meals) today.meals = [[], [], []];

  mealListMerge(today.meals, meals);

  mealListMerge(tomorrow.packedMeals, packedMeals);

  today.unmarked = unmarked;

  today.noMeals = noMeals;

  today.markModified("meals");
  tomorrow.markModified("packedMeals");
  today.markModified("unmarked");
  today.markModified("noMeals");
}

const mealListMerge = (meals, newMeals) => {
  // Merges the meals and new Meals, but only if the user is not already in the list

  // Go over all types of meals, and compare to the new meals
  meals.forEach((meal, index) => {
    newMeals[index].forEach((newMeal) => {
      // Search for the same user in the meal list based on the ID
      const found = meal.find((meal) => meal._id.toString() === newMeal._id.toString());


      // If the user is not found, add them to the meal list
      if (!found) {
        meal.push(newMeal);
      }
    });
  });
}

const saveIfExists = async (data) => {
  if (data) {
    await data.save();
    console.log("Saved next week");
  }
  
};

const constructMealUserObject = (user) => {
  return {
    name: user.firstName + " " + user.lastName,
    _id: user._id,
    diet: user.diet,
  };
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

// forces the route handler to be dynamic
export const dynamic = "force-dynamic";
