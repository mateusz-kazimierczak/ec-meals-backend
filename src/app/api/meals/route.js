import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const getNextUpdateTime = () => {
  // Get the time until the next update, and the index of the day that should be disabled
  const currentStandardTime = new Date();
  const timezoneOffsetHours = currentStandardTime.getTimezoneOffset() / 60;
  const desiredOffset = -4; // The desired timezone offset

  // Calculate the difference between the current timezone offset and the desired timezone offset
  const offsetDifference = timezoneOffsetHours - desiredOffset;

  // Create a new Date object with the adjusted time
  const currTime = new Date(
    currentStandardTime.getTime() - offsetDifference * 60 * 60 * 1000
  );

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

  console.log("Next update time: ", nextUpdateTime);

  return [nextUpdateTime.getTime(), disabledDay, currTime];
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

  if (!data) {
    return Response.json({ message: "User not found" }, { status: 404 });
  }

  const [updateTime, disabledDay, currTime] = getNextUpdateTime();

  return Response.json({
    meals: data.meals,
    firstName: data.firstName,
    currTime: currTime,
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

  console.log("post meals route", data);

  const user = await User.findByIdAndUpdate(forUser, { meals: data.meals });

  return Response.json({
    currTime: new Date(),
    updateTime: getNextUpdateTime(),
  });
}
