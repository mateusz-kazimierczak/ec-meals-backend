import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";
import Day from "@/_helpers/db/models/Day";
import mongoose from "mongoose";
import { getNextUpdateTime, reconstructDate, isWithin5Days, isWithinAWeek, getAppDayIndex, isToday, isNowPastUpdateTime, isTomorrow, isBeforeUpdateTime, isNDaysFromNow, TIMEZONE_CONSTANT } from "@/_helpers/time";
import { parse } from "path";

export async function POST(req, res) {
  const [body] = await Promise.all([req.json(), connectDB()]);

  const [day, users] = await Promise.all([
    Day.findOne({ date: body.date }).catch((err) => {
      console.log(err);
    }), 
    User.find(
      { active: true },
      "firstName lastName meals preferences diet"
    )])

  // Get the actual data from the string
  const date = reconstructDate(body.date);
  const now = new Date();

  

  date.setUTCHours(
    parseInt(process.env.UPDATE_TIME.slice(0, 2)) - TIMEZONE_CONSTANT
  );

  date.setUTCMinutes(process.env.UPDATE_TIME.slice(2));

  let allMeals;

  console.log("Date", date);
  console.log("Now", now);

  if (date > new Date()) {

    console.log("Date is in the future");
    // The starting point are the meals already existing in the day object
    const mealArrs = buildMealArraysFromDay(day);

    if (isWithinAWeek(date)) { 
      // Get meals from user matrices
      const getPackedMeals = !isToday(date)
      // const getNormalMeals = !isNDaysFromNow(date, 7);
      // console.log("Getting meals from user matrices", getNormalMeals);
      addMealsFromUserMatrix(date, users, mealArrs, getPackedMeals);
    }

    checkUnmarkedUsers(users, mealArrs);


    allMeals = {
      meals: mealArrs.meals,
      packedMeals: mealArrs.packedMeals,
      noMeals: mealArrs.noMeals,
      unmarked: mealArrs.unmarked,
    };

    addGuests(day, allMeals);

    return Response.json({
      meals: allMeals,
      allUsers: users,
      status: "prediction",
    });
  } else {

    console.log("Date is in the past");
    // If the date is in the past, and a report already exists, return the report

    if (!day) {
      return Response.json({
        meals: {
          error: "Day not found",
        },
      });
    }

    allMeals = {
      meals: day.meals ? day.meals : [[], [], []],
      packedMeals: day.packedMeals ? day.packedMeals : [[], [], []],
      noMeals: day.noMeals,
      unmarked: day.unmarked,
    };

    addGuests(day, allMeals);

    return Response.json({
      meals: allMeals,
      allUsers: users,
      status: "final",
    });
  }
}

const buildMealArraysFromDay = (day) => {
  let meals = [[], [], []];
  let packedMeals = [[], [], []];
  let noMeals = [];

  if (day && day.meals) meals = day.meals;
  if (day && day.packedMeals) packedMeals = day.packedMeals;
  if (day && day.noMeals) noMeals = day.noMeals;

  return {
    meals,
    packedMeals,
    noMeals,
    unmarked: [],
  }
}

const addMealsFromUserMatrix = (date, users, mealArrs, getPackedMeals = true, getNormalMeals = true) => {

  // Monday is index 0
  let dateIndex = date.getDay() - 1;
  if (dateIndex < 0) dateIndex = 6;

  users.forEach((user) => {
    if (!user.meals) return;
    if (user.meals[dateIndex][6]) {
      mealArrs.noMeals.push(constructMealUserObject(user));
      return
    }
    user.meals[dateIndex].forEach((meal, index) => {
      if (meal) {
        if (index < 3 && getNormalMeals) {
          if (!mealArrs.meals[index].find((element) => element._id.toString() === user._id.toString()))
            mealArrs.meals[index].push(constructMealUserObject(user));
        } else if (getPackedMeals) {
          if (!mealArrs.packedMeals[index - 3].find((element) => element._id.toString() === user._id.toString()))
            mealArrs.packedMeals[index - 3].push(constructMealUserObject(user));
        }
      }
    });
  });
}

const checkUnmarkedUsers = (users, mealArrs) => {
  // construct a array containing meals, packed meals, no meals
  const allMeals = mealArrs.meals.concat(mealArrs.packedMeals).concat([mealArrs.noMeals]);

  users.forEach((user) => {
    // If the user is not signed up for meals or packed meals, mark as unmarked
    let isMarked = false;

    allMeals.forEach((meal) => {
      if (meal.find((element) => element._id.toString() === user._id.toString())) {
        isMarked = true;
      }
    });

    if (!isMarked) {
      mealArrs.unmarked.push(constructMealUserObject(user));
    }
  });
}



// For adding users and guests as an admin
export async function PATCH(req, res) {
  const [body] = await Promise.all([req.json(), connectDB()]);

  let [day, users] = await Promise.all([
    Day.findOne({ date: body.date }),
    body.users &&
      User.find(
        {
          _id: {
            $in: body.users.map((user) => new mongoose.Types.ObjectId(user)),
          },
        },
        "firstName lastName diet _id"
      ),
  ]);

  if (!day) {
    day = new Day({
      date: body.date,
      meals: [[], [], []],
      packedMeals: [[], [], []],
      guests: [],
      noMeals: [],
    });
  } else if (!day.meals) {
    day.meals = [[], [], []];
  } else if (!day.packedMeals) {
    day.packedMeals = [[], [], []];
  } else if (!day.guests) {
    day.guests = [];
  } else if (!day.noMeals) {
    day.noMeals = [];
  }

  if (body.guest) {
    day.guests.push({
      meal: body.meal,
      name: body.guest.name,
      diet: body.guest.diet,
    });
    day.markModified("guests");
    await day.save();
    return Response.json({
      code: "ok",
    });
  } else {
    const mealsIndex = MEALS.indexOf(body.meal);

    if (mealsIndex < 3) {
      // Meals are standard meals
      users.forEach(async (user) => {
        let existingElement = day.meals[mealsIndex].find(
          (element) => element._id.toString() === user._id.toString()
        );

        if (!existingElement) {
        if (isWithinAWeek(reconstructDate(body.date)) && !(isToday(reconstructDate(body.date)) && isNowPastUpdateTime())) {
          const userObject = await User.findById(user._id);
          userObject.meals[getAppDayIndex(reconstructDate(body.date))][mealsIndex] = true;
          userObject.markModified("meals");
          userObject.save();
        } else {
          day.meals[mealsIndex].push({
            _id: user._id,
            diet: user.diet,
            name: user.firstName + " " + user.lastName,
          });
        }
      }

      });
      day.markModified("meals");
    } else {
      // packed meals
      users.forEach(async (user) => {
        
        if (isWithinAWeek(reconstructDate(body.date)) && !(isTomorrow(reconstructDate(body.date)) && isNowPastUpdateTime())) {
          const userObject = await User.findById(user._id);
          userObject.meals[getAppDayIndex(reconstructDate(body.date))][mealsIndex] = true;
          userObject.markModified("meals");
          userObject.save();
        } else {
          day.packedMeals[mealsIndex - 3].push({
            _id: user._id,
            diet: user.diet,
            name: user.firstName + " " + user.lastName,
          });
        }

      });
      day.markModified("packedMeals");

      

    }

    // remove all users from the noMeals array
    day.noMeals = day.noMeals.filter(
      (element) => !body.users.includes(element._id.toString())
    );
    day.markModified("noMeals");

    // remove all users from the unmarked array
    day.unmarked = day.unmarked.filter(
      (element) => !body.users.includes(element._id.toString())
    );
    day.markModified("unmarked");

    await day.save();


    return Response.json({
      code: "ok",
    });
  }
}


async function checkUsersMeals(date, users) {
  var dt = reconstructDate(date);

  const meals = [[], [], []];
  const packedMeals = [[], [], []];
  const noMeals = [];
  const unmarked = [];

  // Monday is index 0
  let dateIndex = dt.getDay() - 1;
  if (dateIndex < 0) dateIndex = 6;


  users.forEach((user) => {
    if (!user.meals) return;
    if (user.meals[dateIndex][6]) {
      return noMeals.push(constructMealUserObject(user));
    }
    if (user.meals[dateIndex].every((meal) => !meal)) {
      return unmarked.push(constructMealUserObject(user));
    }
    user.meals[dateIndex].forEach((meal, index) => {
      if (meal) {
        if (index < 3) {
          meals[index].push(constructMealUserObject(user));
        } else {
          packedMeals[index - 3].push(constructMealUserObject(user));
        }
      }
    });
  });
  return [meals, packedMeals, noMeals, unmarked];
}


const addGuests = (day, allMeals) =>
  day?.guests.forEach((guest) => {
    if (guest.meal < 3) {
      allMeals.meals[guest.meal].push({
        name: guest.name,
        diet: guest.diet,
        _id: "_GUEST_" + guest.name,
      });
    } else {
      allMeals.packedMeals[guest.meal - 3].push({
        name: guest.name,
        diet: guest.diet,
        _id: "_GUEST_" + guest.name,
      });
    }
  });

const constructMealUserObject = (user) => {
  return {
    name: user.firstName + " " + user.lastName,
    _id: user._id,
    diet: user.diet,
  };
};

const MEALS = ["Breakfast", "Lunch", "Dinner", "P1", "P2", "PS"];

// forces the route handler to be dynamic
export const dynamic = "force-dynamic";
