import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";
import { get } from "http";

const getNextUpdateTime = () => {
  const currTime = new Date();
  const nextUpdateTime = new Date();

  const timezoneOffset = new Date().getTimezoneOffset();

  const nextUpdateHour =
    parseInt(process.env.UPDATE_TIME.slice(0, 2)) + timezoneOffset / 60 - 4; // 4 is the offset for EST

  if (nextUpdateHour < 0) {
    nextUpdateTime.setHours(
      24 + nextUpdateHour,
      parseInt(process.env.UPDATE_TIME.slice(2)),
      0,
      0
    );
  } else {
    nextUpdateTime.setHours(
      parseInt(nextUpdateHour), // 4 is the offset for EST
      parseInt(process.env.UPDATE_TIME.slice(2)),
      0,
      0
    );
    nextUpdateTime.setDate(nextUpdateTime.getDate() + 1);
  }

  if (currTime - nextUpdateTime > 0) {
    nextUpdateTime.setDate(nextUpdateTime.getDate() + 1);
  }

  return nextUpdateTime.getTime();
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

  const updateTimeToday = new Date();
  updateTimeToday.setHours(
    parseInt(process.env.UPDATE_TIME.slice(0, 2)),
    parseInt(process.env.UPDATE_TIME.slice(2)),
    0,
    0
  );

  let disabledDay;

  if (Date.now > updateTimeToday) {
    disabledDay = new Date().getDay();
  } else {
    disabledDay = new Date().getDay() - 1;
  }

  if (disabledDay < 0) disabledDay = 6;

  const data = await User.findById(forUser, "meals firstName");

  return Response.json({
    meals: data.meals,
    firstName: data.firstName,
    currTime: new Date(),
    updateTime: getNextUpdateTime(),
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
