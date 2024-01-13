import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";

import { NextResponse } from "next/server";

export async function GET(req, res) {
  console.log("req received!");
  await connectDB();
  const users = await User.find({});

  return Response.json(users);
}
