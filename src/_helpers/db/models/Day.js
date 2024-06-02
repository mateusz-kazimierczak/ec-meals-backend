const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const schema = new Schema(
  {
    date: { type: String, unique: true, required: true },
    meals: { type: Object },
    packedMeals: { type: Object },
    noMeals: { type: Array },
    unmarked: { type: Array },
    guests: { type: Array },
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

export default mongoose.models.Day || mongoose.model("Day", schema);
