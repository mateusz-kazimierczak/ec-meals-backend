import connectDB from "./db/connect.js";
import { Settings } from "./db/models/Settings.js";

export const getSetting = async (key) => {
  await connectDB();
  const doc = await Settings.findById(key).lean();
  return doc ?? null;
};
