import mongoose from "mongoose";

await mongoose.connect(process.env.MONGODB_URI, {
  authSource: "admin",
  user: "admin",
  pass: "admin",
});

mongoose.Promise = global.Promise;

import userModel from "./models/User.js";

export const db = {
  User: userModel(),
};
