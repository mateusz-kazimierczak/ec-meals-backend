import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";
import bcrypt from "bcryptjs";

import { NextResponse } from "next/server";
import initUser from "@/_helpers/db/initUser";

import { sendWelcomeEmail } from "@/_helpers/emails";
import { Types } from "mongoose";

const buildUser = async (ujson) => {
  console.log(ujson);
  const user = {
    username: ujson.username,
    firstName: ujson.firstName,
    lastName: ujson.lastName,
    email: ujson.email,
    room: ujson.room,
    role: ujson.role,
    active: ujson.active,
    guest: ujson.guest,
    birthday: ujson.birthday || null,
    diet: ujson.diet || null,
  };

  if (ujson.password) {
    const hash = await bcrypt.hash(ujson.password, 10);
    user.hash = hash;
  }

  user.username = user.username.toLowerCase().trim();

  return user;
};

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

  const user = await buildUser(data);

  console.log("new user data", user.diet);

  await User.findOneAndUpdate({ _id: user_id }, user).catch((err) => {
    console.log(err);
  });

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

  const user = await buildUser(data);

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
