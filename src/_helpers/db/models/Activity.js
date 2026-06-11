import mongoose from "mongoose";

const { Schema } = mongoose;

const schema = new Schema(
  {
    mailchimpId:  { type: String, required: true, unique: true },
    title:        { type: String, required: true },
    activityName: { type: String, default: "" },
    // When the event actually happens (e.g. the Friday evening)
    activityDate: { type: Date, required: true },
    // When the email is/was sent or scheduled; set on send/schedule action
    sendTime:     { type: Date, default: null },
    status: {
      type: String,
      default: "save",
      enum: ["save", "draft", "schedule", "sending", "sent", "paused", "cancelled"],
    },
    // Rich HTML from the editor; used for the home screen widget
    body:       { type: String, required: true },
    emailsSent: { type: Number, default: 0 },
  },
  { timestamps: true }
);

schema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret._id;
  },
});

export default mongoose.models.Activity || mongoose.model("Activity", schema);
