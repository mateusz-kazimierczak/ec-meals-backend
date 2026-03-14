import { revalidateTag } from "next/cache";
import connectDB from "@/_helpers/db/connect";
import { Settings } from "@/_helpers/db/models/Settings";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) return Response.json({ error: "key param required" }, { status: 400 });

  await connectDB();
  const doc = await Settings.findById(key).lean();

  return Response.json(doc ?? null);
}

export async function POST(req) {
  const role = req.headers.get("userRole");
  if (role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (!body._id) return Response.json({ error: "_id required" }, { status: 400 });

  await connectDB();
  await Settings.findByIdAndUpdate(
    body._id,
    { $set: body },
    { upsert: true, new: true },
  );

  revalidateTag("settings");

  // Trigger settings_sync DAG via Airflow API
  try {
    const tokenRes = await fetch(`${process.env.AIRFLOW_API_URL}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: process.env.AIRFLOW_USER,
        password: process.env.AIRFLOW_PASSWORD,
      }),
    });

    if (tokenRes.ok) {
      const { access_token } = await tokenRes.json();
      await fetch(`${process.env.AIRFLOW_API_URL}/api/v2/dags/settings_sync/dagRuns`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ conf: { env: "prod" } }),
      });
    }
  } catch (err) {
    // Non-fatal: settings are saved; DAG sync will pick up on next manual trigger
    console.error("Failed to trigger settings_sync DAG:", err.message);
  }

  return Response.json({ ok: true });
}
