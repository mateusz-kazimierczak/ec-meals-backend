import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";
import Day from "@/_helpers/db/models/Day";
import mongoose from "mongoose";
import { getNextUpdateTime, reconstructDate, isWithin5Days } from "@/_helpers/time";
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


  date.setUTCHours(parseInt(process.env.UPDATE_TIME.slice(0, 2)) + 4, parseInt(process.env.UPDATE_TIME.slice(2, 4)));

  let allMeals;

  // Check if the date is within 5 days
  if (!isWithin5Days(date)) {
    return Response.json({
      meals: {
        error: "Date is too far in the future",
      },
    });
  } else if (date > new Date()) {
    let [[meals, packedMeals, noMeals, unmarked]] = await Promise.all([
      checkUsersMeals(body.date, users),
    ]);

    // Must remove from unmarked people that already have a packed meal
    packedMeals.forEach((packedMeal) => {
      packedMeal.forEach((user) => {
        unmarked = unmarked.filter(
          (unmarkedUser) => unmarkedUser._id.toString() !== user._id.toString()
        );
      });
    });

    allMeals = {
      meals: day?.meals ? day.meals : meals,
      packedMeals: day?.packedMeals ? day.packedMeals : packedMeals,
      noMeals: day?.noMeals ? day.noMeals : noMeals,
      unmarked: unmarked,
    };

    addGuests(day, allMeals);

    return Response.json({
      meals: allMeals,
      allUsers: users,
      status: "prediction",
    });
  } else {
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
    });
    console.log("creating new day");
  }

  if (body.guest) {
    console.log("adding guest");
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
    console.log("adding users");
    const mealsIndex = MEALS.indexOf(body.meal);

    if (mealsIndex < 3) {
      // Meals are standard meals
      users.forEach((user) => {
        let existingElement = day.meals[mealsIndex].find(
          (element) => element._id.toString() === user
        );
        if (!existingElement) {
          day.meals[mealsIndex].push({
            _id: user._id,
            diet: user.diet,
            name: user.firstName + " " + user.lastName,
          });
        }
      });
      day.markModified("meals");
    } else {
      // packed meals
      users.forEach((user) => {
        let existingElement = day.packedMeals[mealsIndex - 3].find(
          (element) => element._id.toString() === user
        );
        if (!existingElement) {
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

    console.log(body);
    console.log(JSON.stringify(day));
    console.log(day.meals[0]);

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
      });
    } else {
      allMeals.packedMeals[guest.meal - 3].push({
        name: guest.name,
        diet: guest.diet,
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
