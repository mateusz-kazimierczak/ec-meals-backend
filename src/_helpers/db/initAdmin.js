import bcrypt from "bcryptjs";
import User from "../db/models/User";
import connectDB from "../db/connect";
import initUser from "./initUser";

await connectDB();

User.countDocuments({ role: "admin" }).then(async (count) => {
  console.log("Checking ADMIN user -----------");
  if (count === 0) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || "admin", 10);
    const admin = new User({
      username: process.env.ADMIN_USERNAME || "admin",
      hash,
      firstName: "admin",
      lastName: "admin",
      role: "admin",
    });
    initUser(admin);
    try {
      admin.save();
      console.log("Admin user created");
    } catch (err) {
      console.log(err);
    }
  } else {
    return console.log("admin user already present");
  }
});
