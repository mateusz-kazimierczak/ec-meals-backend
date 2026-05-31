export const dynamic = "force-dynamic";

import connectDB from "@/_helpers/db/connect";
import Activity from "@/_helpers/db/models/Activity";
import User from "@/_helpers/db/models/User";

// GET /api/home/current-activity
// Returns the current activity if the send time has passed and the activity day hasn't ended.
// Replaces *|FNAME|* with the logged-in user's first name.
// Accessible to all logged-in users (/api/home is in authOnly middleware list).
export async function GET(req) {
  const userId = req.headers.get("userID");

  await connectDB();

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const activity = await Activity.findOne({
    sendTime: { $lte: now },
    activityDate: { $gte: startOfToday },
  })
    .sort({ activityDate: 1 })
    .lean();

  if (!activity) {
    return Response.json({ activity: null });
  }

  let firstName = "there";
  if (userId) {
    const user = await User.findById(userId).select("firstName").lean();
    if (user?.firstName) firstName = user.firstName;
  }

  const body = (activity.body || "").replace(/\*\|FNAME\|\*/g, firstName);

  return Response.json({
    activity: {
      title: activity.title,
      activityName: activity.activityName,
      activityDate: activity.activityDate,
      sendTime: activity.sendTime,
      body,
    },
  });
}
