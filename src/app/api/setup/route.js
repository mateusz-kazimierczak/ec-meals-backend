import InitAdmin from "../../../_helpers/db/initAdmin";
import User from "@/_helpers/db/models/User";
export async function GET() {
  await InitAdmin();
  const users = await User.find();

  return Response.json({ message: "Admin created!", users });
}
