import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";
import { cookies } from "next/headers";

import { getNextUpdateTime } from "@/_helpers/time";
import moment from "moment-timezone";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req, res) {
  await connectDB();

  const ROLE = req.headers.get("userRole");
  let forUser = req.headers.get("forUser");

  if (forUser == "undefined" || !forUser) {
    forUser = req.headers.get("userID");
  } else if (ROLE != "admin") {
    return Response.json({ message: "Unauthorized" }, { status: 403 });
  }

  const data = await User.findById(forUser, "meals firstName");

  if (!data) {
    return Response.json({ message: "User not found" }, { status: 404 });
  }

  const [updateTime, disabledDay] = getNextUpdateTime();



  return Response.json({
    meals: data.meals,
    firstName: data.firstName,
    currTime: moment(new Date()).valueOf(),
    updateTime: updateTime.valueOf(),
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
