import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";
import bcrypt from "bcryptjs";

import { NextResponse } from "next/server";
import initUser from "@/_helpers/db/initUser";
import { buildAuditRowDiff, logUserSettingsChange } from "@/_helpers/userSettingsAudit";

import { sendWelcomeEmail } from "@/_helpers/emails";
import { Types } from "mongoose";
import { defaultNotificationPreferences } from '../../preferences/notifications/defaults'

const buildUser = async (ujson, { includeNotificationDefaults = false } = {}) => {
  console.log(ujson);
  // get day adn month as int from the birthday string (format: "dd/mm")
  if (ujson.birthday) {
    const [day, month] = ujson.birthday.split("/").map((x) => parseInt(x));
    ujson.birthday = { day, month };
  } 

  const user = {
    username: ujson.username,
    firstName: ujson.firstName,
    lastName: ujson.lastName,
    email: ujson.email,
    room: ujson.room,
    role: ujson.role,
    active: ujson.active,
    guest: ujson.guest,
    birthdayDay: ujson.birthday?.day || null,
    birthdayMonth: ujson.birthday?.month || null,
    diet: ujson.diet || null,
  };

  if (includeNotificationDefaults) {
    user.notifications = defaultNotificationPreferences;
  }

  if (ujson.password) {
    const hash = await bcrypt.hash(ujson.password, 10);
    user.hash = hash;
  }

  user.username = user.username.toLowerCase().trim();

  return user;
};

const getUserAuditSnapshot = (user) => {
  if (!user) return {};

  return {
    firstName: user.firstName || null,
    lastName: user.lastName || null,
    username: user.username || null,
    email: user.email || null,
    role: user.role || null,
    room: user.room || null,
    active: !!user.active,
    guest: !!user.guest,
    diet: user.diet || null,
    birthdayDay: user.birthdayDay ?? null,
    birthdayMonth: user.birthdayMonth ?? null,
  };
};

const USER_AUDIT_FIELDS = [
  "firstName",
  "lastName",
  "username",
  "email",
  "role",
  "room",
  "active",
  "guest",
  "diet",
  "birthdayDay",
  "birthdayMonth",
];

export async function GET(req, res) {
  await connectDB();
  let user_id = req.headers.get("user_id");

  if (!user_id || user_id == "undefined") user_id = req.headers.get("userID");

  if (
    !req.headers.get("role") == "admin" &&
    user_id != req.headers.get("userID")
  ) {
    return new NextResponse(null, {
      status: 402,
      headers: {
        "content-type": "application/json",
      },
    });
  }

  const user = await User.findById(user_id);

  return Response.json(user);
}

export async function PATCH(req, res) {
  await connectDB();

  let user_id = req.headers.get("user_id");

  if (!user_id || user_id == "undefined") user_id = req.headers.get("userID");

  const data = await req.json();
  const actorUserId = req.headers.get("userID");
  const actorRole = req.headers.get("userRole");

  const beforeUser = await User.findById(user_id, "firstName lastName username email role room active guest diet birthdayDay birthdayMonth").lean();
  const beforeSnapshot = getUserAuditSnapshot(beforeUser);

  const user = await buildUser(data);
  const passwordChanged = Boolean(user.hash);

  console.log("new user data", user.diet);

  await User.findOneAndUpdate({ _id: user_id }, user).catch((err) => {
    console.log(err);
  });

  const afterUser = await User.findById(user_id, "firstName lastName username email role room active guest diet birthdayDay birthdayMonth").lean();
  const afterSnapshot = getUserAuditSnapshot(afterUser);

  const diff = buildAuditRowDiff(beforeSnapshot, afterSnapshot, USER_AUDIT_FIELDS);

  if (diff.changedFields.length > 0 || passwordChanged) {
    if (passwordChanged && !diff.changedFields.includes("password")) {
      diff.changedFields.push("password");
    }

    await logUserSettingsChange({
      actorUserId,
      actorRole,
      targetUserId: user_id,
      changeType: "USER_PROFILE_UPDATE",
      changedFields: diff.changedFields,
      oldValues: diff.oldValues,
      newValues: diff.newValues,
      metadata: {
        passwordChanged,
        requestPath: req.nextUrl.pathname,
      },
      requestPath: req.nextUrl.pathname,
      userAgent: req.headers.get("user-agent"),
    });
  }

  console.log("user updated");

  return Response.json({ success: true });
}

export async function DELETE(req, res) {
  await connectDB();

  let user_id = req.headers.get("user_id");

  if (req.headers.get("userRole") != "admin") {
    return new NextResponse(null, {
      status: 402,
      headers: {
        "content-type": "application/json",
      },
    });
  }

  await User.findOneAndDelete({ _id: user_id });

  console.log("user deleted");

  return Response.json({ success: true });
}

export async function POST(req, res) {
  await connectDB();

  const data = await req.json();

  const user = await buildUser(data, { includeNotificationDefaults: true });

  initUser(user);

  console.log(data);

  try {
    await User.create(user);
  } catch (err) {
    console.log("error while creatiunbg user: ", err);
    return new Response(
      { success: false },
      {
        status: 500,
      }
    );
  }

  if (data.email && data.sendWelcomeEmail) {
    sendWelcomeEmail(
      { email: data.email, firstName: data.firstName, username: data.username },
      data.password
    );
  }

  return Response.json({ success: true, new: "yes" });
}

// forces the route handler to be dynamic
export const dynamic = "force-dynamic";
