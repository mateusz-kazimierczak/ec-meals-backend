import { describe, expect, it } from "vitest";
import Diet from "../../src/_helpers/db/models/Diet.js";
import { buildTestApp } from "../helpers/app.js";
import { injectJson } from "../helpers/http.js";
import { seedUsers, tokenFor } from "../helpers/fixtures.js";
import { mockAirflowSuccess } from "../helpers/externalMocks.js";

describe("admin routes", () => {
  it("creates, lists, rejects duplicate, and deletes diets", async () => {
    const app = await buildTestApp();
    const { admin } = await seedUsers();
    const token = tokenFor(admin);
    await Diet.init();

    const created = await injectJson(app, {
      method: "POST",
      url: "/api/diets",
      token,
      payload: { name: " Vegetarian " },
    });
    expect(created.statusCode).toBe(200);
    expect(created.body.message).toBe("OK");
    expect(created.body.diet.name).toBe("vegetarian");

    const duplicate = await injectJson(app, {
      method: "POST",
      url: "/api/diets",
      token,
      payload: { name: "vegetarian" },
    });
    expect(duplicate.body.message).toBe("DupKey");

    const listed = await injectJson(app, { url: "/api/diets", token });
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0].name).toBe("vegetarian");

    const deleted = await injectJson(app, {
      method: "DELETE",
      url: "/api/diets",
      token,
      payload: { id: created.body.diet.id },
    });
    expect(deleted.body).toEqual({ message: "OK" });

    const listedAfterDelete = await injectJson(app, { url: "/api/diets", token });
    expect(listedAfterDelete.body.data).toHaveLength(0);
  });

  it("stores settings and triggers mocked Airflow when configured", async () => {
    const app = await buildTestApp();
    const { admin } = await seedUsers();
    const token = tokenFor(admin);
    const fetchMock = mockAirflowSuccess();

    process.env.AIRFLOW_API_URL = "https://airflow.test/";
    process.env.AIRFLOW_USER = "airflow-user";
    process.env.AIRFLOW_PASSWORD = "airflow-password";

    const saved = await injectJson(app, {
      method: "POST",
      url: "/api/settings",
      token,
      payload: { _id: "schedule", crons: ["0 8 * * *"] },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.body).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const loaded = await injectJson(app, {
      url: "/api/settings?key=schedule",
      token,
    });
    expect(loaded.statusCode).toBe(200);
    expect(loaded.body).toMatchObject({ _id: "schedule", crons: ["0 8 * * *"] });

    delete process.env.AIRFLOW_API_URL;
    delete process.env.AIRFLOW_USER;
    delete process.env.AIRFLOW_PASSWORD;
  });

  it("validates settings requests", async () => {
    const app = await buildTestApp();
    const { admin } = await seedUsers();
    const token = tokenFor(admin);

    const missingKey = await injectJson(app, {
      url: "/api/settings",
      token,
    });
    expect(missingKey.statusCode).toBe(400);
    expect(missingKey.body).toEqual({ error: "key param required" });

    const missingId = await injectJson(app, {
      method: "POST",
      url: "/api/settings",
      token,
      payload: { value: true },
    });
    expect(missingId.statusCode).toBe(400);
    expect(missingId.body).toEqual({ error: "_id required" });
  });
});
