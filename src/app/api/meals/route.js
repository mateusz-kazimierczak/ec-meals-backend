import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";

export async function GET(req, res) {
  await connectDB();

  const ID = req.headers.get("userID");

  console.log("ID", ID);

  const data = await User.findById(ID, "meals");

  data.currTime = new Date();

  return Response.json(data);
}

export async function POST(req, res) {
  await connectDB();

  const ID = req.headers.get("userID");

  const data = await req.json();

  const user = await User.findByIdAndUpdate(ID, { meals: data.meals });

  return Response.json({ currTime: new Date() });
}
