import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";

export async function GET(req, res) {
  await connectDB();

  const ID = req.headers.get("userID");

  const data = await User.findById(ID, "preferences");

  return Response.json(data);
}

export async function POST(req, res) {
  await connectDB();

  const ID = req.headers.get("userID");

  const pref = await req.json();

  console.log(pref);

  const data = await User.findByIdAndUpdate(ID, {
    preferences: pref,
  });

  return Response.json({
    message: "OK",
  });
}
