import connectDB from "../_helpers/db/connect.js";
import Diet from "../_helpers/db/models/Diet.js";
import { Settings } from "../_helpers/db/models/Settings.js";

export default async function adminRoutes(app) {
  app.get("/api/diets", async () => {
    await connectDB();
    const diets = await Diet.find({}).select("name _id");
    return { message: "OK", data: diets };
  });

  app.post("/api/diets", async (request) => {
    await connectDB();
    const diet = new Diet(request.body || {});

    try {
      const newDietInfo = await diet.save();
      return {
        message: "OK",
        diet: { name: newDietInfo.name, id: newDietInfo._id },
      };
    } catch (error) {
      return { message: error.code === 11000 ? "DupKey" : "Error" };
    }
  });

  app.delete("/api/diets", async (request) => {
    await connectDB();
    try {
      await Diet.deleteOne({ _id: request.body?.id });
      return { message: "OK" };
    } catch {
      return { message: "Error" };
    }
  });

  app.get("/api/settings", async (request, reply) => {
    const key = request.query?.key;
    if (!key) return reply.code(400).send({ error: "key param required" });

    await connectDB();
    return (await Settings.findById(key).lean()) ?? null;
  });

  app.post("/api/settings", async (request, reply) => {
    const body = request.body || {};
    if (!body._id) return reply.code(400).send({ error: "_id required" });

    await connectDB();
    await Settings.findByIdAndUpdate(body._id, { $set: body }, { upsert: true, returnDocument: "after" });

    const airflowUrl = (process.env.AIRFLOW_API_URL ?? "").replace(/\/+$/, "");
    if (airflowUrl && process.env.AIRFLOW_USER && process.env.AIRFLOW_PASSWORD) {
      try {
        const tokenRes = await fetch(`${airflowUrl}/auth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: process.env.AIRFLOW_USER,
            password: process.env.AIRFLOW_PASSWORD,
          }),
        });

        if (tokenRes.ok) {
          const { access_token } = await tokenRes.json();
          await fetch(`${airflowUrl}/api/v2/dags/settings_sync/dagRuns`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ logical_date: new Date().toISOString(), conf: { env: "prod" } }),
          });
        }
      } catch (error) {
        request.log.error({ error }, "Failed to trigger settings sync DAG");
      }
    }

    return { ok: true };
  });
}
