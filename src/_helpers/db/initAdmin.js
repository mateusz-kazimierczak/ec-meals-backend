import bcrypt from "bcryptjs";
import User from "../db/models/User.js";
import connectDB from "../db/connect.js";
import initUser from "./initUser.js";

export default async function initAdmin() {
  await connectDB();

  const count = await User.countDocuments({ role: "admin" });
  if (count > 0) {
    return { created: false };
  }

  const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || "admin", 10);
  const admin = new User({
    username: process.env.ADMIN_USERNAME || "admin",
    hash,
    firstName: "admin",
    lastName: "admin",
    role: "admin",
    email: process.env.ADMIN_EMAIL || undefined,
  });
  initUser(admin);
  await admin.save();
  return { created: true };
}
