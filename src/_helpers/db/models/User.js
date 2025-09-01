import { min } from "moment-timezone";

import { defaultNotificationPreferences } from '../../../app/api/preferences/notifications/defaults'

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const schema = new Schema(
  {
    username: { type: String, unique: true, required: true },
    hash: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: false },
    birthdayMonth: {type: Number, min: 1, max: 12},
    birthdayDay: {type: Number, min: 1, max: 31},
    role: {
      type: String,
      default: "student",
      enum: ["student", "admin", "numerary"],
    },
    email: { type: String, required: false },
    active: { type: Boolean, default: true },
    room: { type: Number, required: false },
    meals: { type: Object, required: true },
    preferences: { type: Object, default: {} },
    diet: { type: String, required: false },
    notifications: {
      type: Object,
      default: undefined
    }
  },
  {
    // add createdAt and updatedAt timestamps
    timestamps: true,
  }
);

schema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.hash;
  },
});

export default mongoose.models.User || mongoose.model("User", schema);
