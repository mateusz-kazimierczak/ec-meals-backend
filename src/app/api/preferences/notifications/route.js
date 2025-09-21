import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";

export async function GET(req, res) {
  await connectDB();
  const forUser_ID = req.headers.get("user_id");

  let ID;
  if (forUser_ID != "undefined") {

    if (req.headers.get("userRole") !== "admin") {
      return Response.json({
        message: "Unauthorized",
      });
    }
    ID = forUser_ID;
  } else {
    ID =req.headers.get("userID");
  }

  const data = await User.findById(ID, "notifications firstName");

  return Response.json(data);
}

export async function POST(req, res) {
  await connectDB();
  const forUser_ID = req.headers.get("user_id");

  let ID;
  const isAdmin = req.headers.get("userRole") === "admin";

  if (forUser_ID != "undefined") {
    if (req.headers.get("userRole") !== "admin") {
      return Response.json({
        message: "Unauthorized",
      });
    }
    ID = forUser_ID;
  } else {
    ID = req.headers.get("userID");
  }


  const pref = await req.json();

  const oldPref = await User.findById(ID, "notifications");

  // If the notifications object does not exist, create it
  if (!oldPref.notifications) {
    oldPref.notifications = {};
  }

  
  oldPref.notifications.notificationTypes = pref.notificationTypes;
  oldPref.notifications.schedule = pref.schedule;
  oldPref.notifications.schema = pref.schema;
  oldPref.notifications.report = pref.report;
  oldPref.notifications.device = pref.device;

  oldPref.markModified("notifications");

  await oldPref.save();

  return Response.json({
    message: "OK",
  });
}

// forces the route handler to be dynamic
export const dynamic = "force-dynamic";
