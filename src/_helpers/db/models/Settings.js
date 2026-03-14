import mongoose from "mongoose";

// strict: false allows any fields; string _id for named categories (e.g. "schedule", "features")
const schema = new mongoose.Schema({ _id: String }, { strict: false, timestamps: true });

export const Settings = mongoose.models.Settings
  || mongoose.model("Settings", schema, "settings");
