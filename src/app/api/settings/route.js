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
    const airflowUrl = (process.env.AIRFLOW_API_URL ?? "").replace(/\/+$/, "");

    const tokenRes = await fetch(`${airflowUrl}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: process.env.AIRFLOW_USER,
        password: process.env.AIRFLOW_PASSWORD,
      }),
    });
    if (!tokenRes.ok) {
      console.error("Airflow auth failed:", tokenRes.status, await tokenRes.text());
    } else {
      const { access_token } = await tokenRes.json();
      const dagRes = await fetch(`${airflowUrl}/api/v2/dags/settings_sync/dagRuns`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ logical_date: new Date().toISOString(), conf: { env: "prod" } }),
      });
      if (!dagRes.ok) {
        console.error("Airflow DAG trigger failed:", dagRes.status, await dagRes.text());
      } else {
        console.log("settings_sync DAG triggered successfully");
      }
    }
  } catch (err) {
    // Non-fatal: settings are saved; DAG sync will pick up on next manual trigger
    console.error("Failed to trigger settings_sync DAG:", err.message);
  }

  return Response.json({ ok: true });
}
