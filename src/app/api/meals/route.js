import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";

const getNextUpdateTime = () => {
  // Get the time until the next update, and the index of the day that should be disabled
  const currTime = new Date();
  const nextUpdateTime = new Date();
  let disabledDay;

  const nextUpdateHour =
    parseInt(process.env.UPDATE_TIME.slice(0, 2)) -
    currTime.getTimezoneOffset() / 60 +
    4;

  nextUpdateTime.setHours(
    nextUpdateHour,
    parseInt(process.env.UPDATE_TIME.slice(2)),
    0,
    0
  );

  if (currTime - nextUpdateTime > 0) {
    nextUpdateTime.setDate(nextUpdateTime.getDate() + 1);
    disabledDay = new Date().getDay() - 1;
  } else {
    disabledDay = new Date().getDay() - 2;
  }

  if (disabledDay == -1) disabledDay = 6;
  else if (disabledDay == -2) disabledDay = 5;

  return [nextUpdateTime.getTime(), disabledDay];
};

export async function GET(req, res) {
  await connectDB();

  const ROLE = req.headers.get("userRole");
  let forUser = req.headers.get("forUser");

  if (forUser == "undefined" || !forUser) {
    forUser = req.headers.get("userID");
  } else if (ROLE != "admin") {
    return Response.json({ message: "Unauthorized" }, { status: 403 });
  }

  console.log("get meals route");

  const data = await User.findById(forUser, "meals firstName");

  const [updateTime, disabledDay] = getNextUpdateTime();

  return Response.json({
    meals: data.meals,
    firstName: data.firstName,
    currTime: new Date(),
    updateTime: updateTime,
    disabledDay,
  });
}

export async function POST(req, res) {
  await connectDB();

  let forUser = req.headers.get("forUser");
  const ROLE = req.headers.get("userRole");

  if (forUser == "undefined" || !forUser) {
    forUser = req.headers.get("userID");
  } else if (ROLE != "admin") {
    return Response.json({ message: "Unauthorized" }, { status: 403 });
  }

  const data = await req.json();

  const user = await User.findByIdAndUpdate(forUser, { meals: data.meals });

  return Response.json({
    currTime: new Date(),
    updateTime: getNextUpdateTime(),
  });
}

// forces the route handler to be dynamic
export const dynamic = "force-dynamic";
