import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";
import { buildAuditRowDiff, logUserSettingsChange } from "@/_helpers/userSettingsAudit";

const PREFERENCE_FIELDS = ["email", "allowNextWeek", "persistMeals", "skipNotSignedUp"];

const getPreferenceSnapshot = (preferences = {}) => {
  return {
    email: preferences.email || 0,
    allowNextWeek: preferences.allowNextWeek || false,
    persistMeals: preferences.persistMeals || false,
    skipNotSignedUp: preferences.skipNotSignedUp || false,
  };
};

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

  const data = await User.findById(ID, "preferences firstName");

  

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

  const actorUserId = req.headers.get("userID");
  const actorRole = req.headers.get("userRole");

  const oldPref = await User.findById(ID, "preferences");
  if (!oldPref.preferences) {
    oldPref.preferences = {};
  }
  const beforeSnapshot = getPreferenceSnapshot(oldPref?.preferences);

  
  oldPref.preferences.email = pref.email;
  oldPref.preferences.allowNextWeek = pref.allowNextWeek;

  if (isAdmin) {
    oldPref.preferences.persistMeals = pref.persistMeals;
    oldPref.preferences.skipNotSignedUp = pref.skipNotSignedUp;
  }
  
  oldPref.markModified("preferences");


  await oldPref.save();

  const afterSnapshot = getPreferenceSnapshot(oldPref.preferences);
  const diff = buildAuditRowDiff(beforeSnapshot, afterSnapshot, PREFERENCE_FIELDS);

  if (diff.changedFields.length > 0) {
    await logUserSettingsChange({
      actorUserId,
      actorRole,
      targetUserId: ID,
      changeType: "GENERAL_PREFERENCES_UPDATE",
      changedFields: diff.changedFields,
      oldValues: diff.oldValues,
      newValues: diff.newValues,
      metadata: {
        isAdmin,
        requestPath: req.nextUrl.pathname,
      },
      requestPath: req.nextUrl.pathname,
      userAgent: req.headers.get("user-agent"),
    });
  }

  return Response.json({
    message: "OK",
  });
}

// forces the route handler to be dynamic
export const dynamic = "force-dynamic";
