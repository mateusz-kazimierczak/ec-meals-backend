import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";
import Day from "@/_helpers/db/models/Day";
import mongoose from "mongoose";

export async function POST(req, res) {
  const [body] = await Promise.all([req.json(), connectDB()]);
  const day = await Day.findOne({ date: body.date }).catch((err) => {
    console.log(err);
  });

  // Get the actual data from the string

  const date = reconstructDate(body.date);

  // Check if the date is within 5 days
  if (!isWithin5Days(date)) {
    return Response.json({
      meals: {
        error: "Date is too far in the future",
      },
    });
  } else if (date > new Date()) {
    const [meals, packedMeals, noMeals] = await checkUsersMeals(body.date);
    return Response.json({
      meals: {
        meals: day?.meals ? day.meals : meals,
        packedMeals: day?.packedMeals ? day.packedMeals : packedMeals,
        noMeals: day?.noMeals ? day.noMeals : noMeals,
        unmarked: day?.unmarked,
      },
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

    return Response.json({
      meals: {
        meals: day.meals,
        packedMeals: day.packedMeals,
        noMeals: day.noMeals,
        unmarked: day.unmarked,
      },
      status: "final",
    });
  }
}

export async function PATCH(req, res) {
  const [body] = await Promise.all([req.json(), connectDB()]);

  const [day, users] = await Promise.all([
    Day.findOne({ date: body.date }),
    User.find(
      {
        _id: {
          $in: body.users.map((user) => new mongoose.Types.ObjectId(user)),
        },
      },
      "firstName lastName diet _id"
    ),
  ]);

  if (!day)
    return Response.json({
      code: "dayNotFound",
    });

  const mealsIndex = MEALS.indexOf(body.meal);

  if (mealsIndex < 3) {
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

function isWithin5Days(date) {
  var today = new Date();
  var in5days = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 5
  );
  if (date <= in5days) return true;
  else return false;
}

async function checkUsersMeals(date) {
  var dt = reconstructDate(date);

  const meals = [[], [], []];
  const packedMeals = [[], [], []];
  const noMeals = [];

  // Monday is index 0
  let dateIndex = dt.getDay() - 1;
  if (dateIndex < 0) dateIndex = 6;

  const users = await User.find(
    { active: true },
    "firstName lastName meals preferences diet"
  );

  users.forEach((user) => {
    if (!user.meals) return;
    if (user.meals[dateIndex][6]) {
      return noMeals.push(constructMealUserObject(user));
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
  return [meals, packedMeals, noMeals];
}

function reconstructDate(date) {
  var parts = date.split("/");
  var dt = new Date(
    parseInt(parts[2], 10),
    parseInt(parts[1], 10) - 1,
    parseInt(parts[0], 10)
  );
  return dt;
}

const constructMealUserObject = (user) => {
  return {
    name: user.firstName + " " + user.lastName,
    _id: user._id,
    diet: user.diet,
  };
};

const MEALS = ["Breakfast", "Lunch", "Dinner", "P1", "P2", "PS"];
