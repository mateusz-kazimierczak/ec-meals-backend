import connectDB from "@/_helpers/db/connect";
import Diet from "@/_helpers/db/models/Diet";

export async function GET(req, res) {
  await connectDB();

  const diets = await Diet.find({}).select("name _id");

  console.log(diets);

  return Response.json({
    message: "OK",
    data: diets,
  });
}

export async function POST(req, res) {
  await connectDB();

  const dietInfo = await req.json();

  const diet = new Diet(dietInfo);

  try {
    const newDietInfo = await diet.save();
    console.log(typeof newDietInfo);
    return Response.json({
      message: "OK",
      diet: {
        name: newDietInfo.name,
        id: newDietInfo._id,
      },
    });
  } catch (err) {
    if (err.code === 11000)
      return Response.json({
        message: "DupKey",
      });
    else
      return Response.json({
        message: "Error",
      });
  }
}

export async function DELETE(req, res) {
  await connectDB();

  const json = await req.json();

  console.log("deleting diet: ", json);

  try {
    await Diet.deleteOne({ _id: json.id });
    return Response.json({
      message: "OK",
    });
  } catch (err) {
    console.log(err);
    return Response.json({
      message: "Error",
    });
  }
}

// forces the route handler to be dynamic
export const dynamic = "force-dynamic";
