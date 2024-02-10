import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";
import Day from "@/_helpers/db/models/Day";

export async function POST(req, res) {
  const [body] = await Promise.all([req.json(), connectDB()]);
  const day = await Day.findOne({ date: body.date }).catch((err) => {
    console.log(err);
  });

  // Get the actuall data from the string

  const date = reconstructDate(body.date);

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
    });
  } else {
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
    });
  }
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
  var parts = date.split("/");
  var dt = new Date(
    parseInt(parts[2], 10),
    parseInt(parts[1], 10) - 1,
    parseInt(parts[0], 10)
  );

  const meals = [[], [], []];
  const packedMeals = [[], [], []];
  const noMeals = [];

  let dateIndex = dt.getDay() - 1;
  if (dateIndex < 0) dateIndex = 6;

  console.log("dateIndex: ", dateIndex);

  const users = await User.find(
    { active: true },
    "firstName lastName meals preferences"
  );

  users.forEach((user) => {
    if (!user.meals) return;
    if (user.meals[dateIndex][6]) {
      return noMeals.push({
        name: user.firstName + " " + user.lastName,
        _id: user._id,
      });
    }
    user.meals[dateIndex].forEach((meal, index) => {
      if (meal) {
        if (index < 3) {
          meals[index].push({
            name: user.firstName + " " + user.lastName,
            id: user._id,
          });
        } else {
          packedMeals[index - 3].push({
            name: user.firstName + " " + user.lastName,
            id: user._id,
          });
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
