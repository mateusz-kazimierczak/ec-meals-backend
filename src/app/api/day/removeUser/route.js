import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";
import Day from "@/_helpers/db/models/Day";
import mongoose from "mongoose";
import { getNextUpdateTime } from "@/_helpers/time";
import { parse } from "path";
import { reconstructDate } from "@/_helpers/time";

export async function POST(req, res) {
  const [body] = await Promise.all([req.json(), connectDB()]);

  // For now, this will only support normal meals (non packed meals)
  const day = reconstructDate(body.date);

  console.log("day", day);
  

  return Response.json({ success: true });
  
}
