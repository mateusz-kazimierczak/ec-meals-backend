import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";
import { cookies } from "next/headers";

import { getNextUpdateTime } from "@/_helpers/time";
import moment from "moment-timezone";

import { BigQuery } from "@google-cloud/bigquery";

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

  const bqClient = new BigQuery(
    {
      projectID: "ec-meals-462913",
      credentials: JSON.parse(process.env.GCP_AUTH || "{}"),

    }
  )

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

if (JSON.stringify(user.meals) !== JSON.stringify(data.meals)) {
  console.log("diff meals")
    try {
    const datasetId = "meal_history";
    const tableId = "HISTORY";
  await bqClient.dataset(datasetId).table(tableId).insert([
    {
      USER_ID: req.headers.get("userID"),
      CHANGE_TIME: new Date(),
      IS_SYSTEM_CHANGE: false,
      OLD_MEALS: JSON.stringify(user.meals),
      NEW_MEALS: JSON.stringify(data.meals),
    },
  ]);
} catch (error) {
  console.error("BigQuery insert error:", JSON.stringify(error, null, 2));
}
}



  return Response.json({
    currTime: new Date(),
    updateTime: getNextUpdateTime(),
  });
}
