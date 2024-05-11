import { NextResponse } from "next/server.js";
import initAdmin from "../../../../_helpers/db/initAdmin.js";

export async function GET() {
  await initAdmin();
  return NextResponse.json({ message: "Admin user created" });
}
