import { NextResponse } from "next/server";

// import { db } from "../../../_helpers/db/db";
// const User = db.User;

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
import NextCors from "nextjs-cors";

import connectDB from "../../../_helpers/db/connect";
import User from "../../../_helpers/db/models/User";

import { registerUserSchema } from "./schemas";

// Login handler
export async function POST(req, res) {
  await connectDB();

  if (req.method === "OPTIONS") {
    return res.status(200).send("ok");
  }

  const data = await req.json();

  console.log(data);
  // Do some validation here
  const user = await User.findOne({ username: data.username })
    .select("hash username active role")
    .catch((e) => {
      // Do some more error hanlding here
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    });

  const pass = await bcrypt.compare(data.password, user.hash);

  if (!pass)
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });

  if (user.active === false) {
    return NextResponse.json(
      {
        error: "Your account is not active. Please contact the administrator.",
      },
      { status: 402 }
    );
  }

  const token = jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "10h" }
  );

  console.log("success login");

  return NextResponse.json({ token, username: user.username, role: user.role });
}

// Register handler
export async function PUT(req, res) {
  const formData = await req.formData();
  const data = registerUserSchema.validate(Object.fromEntries(formData));
  console.log(data);
}
