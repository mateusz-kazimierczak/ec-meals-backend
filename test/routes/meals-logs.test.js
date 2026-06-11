import { describe, expect, it } from "vitest";
import { getPostgresPool } from "../../src/_helpers/postgres.js";
import User from "../../src/_helpers/db/models/User.js";
import { buildTestApp } from "../helpers/app.js";
import { injectJson } from "../helpers/http.js";
import { buildMeals, seedUsers, tokenFor } from "../helpers/fixtures.js";

describe("meal and log routes", () => {
  it("returns meals for the authenticated user", async () => {
    const app = await buildTestApp();
    const { student } = await seedUsers();

    const { statusCode, body } = await injectJson(app, {
      url: "/api/meals",
      token: tokenFor(student),
    });

    expect(statusCode).toBe(200);
    expect(body.firstName).toBe("Student");
    expect(body.meals).toEqual(student.meals);
    expect(body.currTime).toEqual(expect.any(Number));
    expect(body.updateTime).toEqual(expect.any(Number));
  });

  it("allows admin forUser access and rejects regular forUser access", async () => {
    const app = await buildTestApp();
    const { admin, student, otherStudent } = await seedUsers();

    const allowed = await injectJson(app, {
      url: "/api/meals",
      token: tokenFor(admin),
      headers: { forUser: student._id.toString() },
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.body.firstName).toBe("Student");

    const rejected = await injectJson(app, {
      url: "/api/meals",
      token: tokenFor(student),
      headers: { forUser: otherStudent._id.toString() },
    });
    expect(rejected.statusCode).toBe(403);
    expect(rejected.body).toEqual({ message: "Unauthorized" });
  });

  it("updates meals and writes changed meal history to Postgres", async () => {
    const app = await buildTestApp();
    const { student } = await seedUsers();
    const token = tokenFor(student);
    const newMeals = buildMeals();
    newMeals[0][0] = true;

    const updated = await injectJson(app, {
      method: "POST",
      url: "/api/meals",
      token,
      payload: { meals: newMeals },
    });
    expect(updated.statusCode).toBe(200);

    const user = await User.findById(student._id).lean();
    expect(user.meals).toEqual(newMeals);

    const history = await getPostgresPool().query("SELECT * FROM meal_history WHERE user_id = $1", [student._id.toString()]);
    expect(history.rows).toHaveLength(1);
    expect(history.rows[0].old_meals).toEqual(student.meals);
    expect(history.rows[0].new_meals).toEqual(newMeals);

    const logs = await injectJson(app, {
      url: "/api/logs",
      token,
      headers: { week: "1" },
    });
    expect(logs.statusCode).toBe(200);
    expect(logs.body.logs).toHaveLength(1);
    expect(logs.body.logs[0]).toMatchObject({
      USER_ID: student._id.toString(),
      IS_SYSTEM_CHANGE: false,
    });
    expect(logs.body.logs[0].CHANGE_TIME.value).toEqual(expect.any(String));
    expect(JSON.parse(logs.body.logs[0].NEW_MEALS)).toEqual(newMeals);
  });

  it("does not write duplicate meal history when meals do not change", async () => {
    const app = await buildTestApp();
    const { student } = await seedUsers();
    const token = tokenFor(student);

    await injectJson(app, {
      method: "POST",
      url: "/api/meals",
      token,
      payload: { meals: student.meals },
    });

    const history = await getPostgresPool().query("SELECT * FROM meal_history WHERE user_id = $1", [student._id.toString()]);
    expect(history.rows).toHaveLength(0);
  });

  it("returns 404 when an admin requests meals for a missing user", async () => {
    const app = await buildTestApp();
    const { admin } = await seedUsers();

    const result = await injectJson(app, {
      url: "/api/meals",
      token: tokenFor(admin),
      headers: { forUser: "000000000000000000000000" },
    });

    expect(result.statusCode).toBe(404);
    expect(result.body).toEqual({ message: "User not found" });
  });
});
