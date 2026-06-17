import { createDiet, deleteDiet, listDiets } from "../data/users.js";
import { getSetting, upsertSetting } from "../data/settings.js";

export default async function adminRoutes(app) {
  app.get("/api/diets", async () => {
    return { message: "OK", data: await listDiets() };
  });

  app.post("/api/diets", async (request) => {
    try {
      const newDietInfo = await createDiet(request.body?.name);
      return {
        message: "OK",
        diet: { name: newDietInfo.name, id: newDietInfo.id },
      };
    } catch (error) {
      return { message: error.code === "23505" ? "DupKey" : "Error" };
    }
  });

  app.delete("/api/diets", async (request) => {
    try {
      await deleteDiet(request.body?.id);
      return { message: "OK" };
    } catch {
      return { message: "Error" };
    }
  });

  app.get("/api/settings", async (request, reply) => {
    const key = request.query?.key;
    if (!key) return reply.code(400).send({ error: "key param required" });

    return getSetting(key);
  });

  app.post("/api/settings", async (request, reply) => {
    const body = request.body || {};
    if (!body._id) return reply.code(400).send({ error: "_id required" });

    await upsertSetting(body);

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
