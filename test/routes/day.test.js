import { describe, expect, it, vi } from "vitest";
import Day from "../../src/_helpers/db/models/Day.js";
import User from "../../src/_helpers/db/models/User.js";
import { buildTestApp } from "../helpers/app.js";
import { injectJson } from "../helpers/http.js";
import {
  buildMeals,
  createDay,
  createUser,
  mealEntryFor,
  tokenFor,
} from "../helpers/fixtures.js";

describe("day routes", () => {
  it("predicts future day meals from active user meal matrices and includes guests", async () => {
    vi.setSystemTime(new Date("2026-06-10T16:00:00.000Z"));
    const app = await buildTestApp();
    const admin = await createUser({ username: "admin", role: "admin", active: false });
    const studentMeals = buildMeals();
    studentMeals[4][0] = true;
    studentMeals[4][3] = true;
    const noMeals = buildMeals();
    noMeals[4][6] = true;
    const student = await createUser({ username: "student", firstName: "Student", lastName: "One", meals: studentMeals, diet: "vegan" });
    const noMealStudent = await createUser({ username: "nomeal", firstName: "No", lastName: "Meals", meals: noMeals });

    await createDay({
      date: "12/6/2026",
      guests: [
        { meal: 1, name: "Lunch Guest", diet: "gf" },
        { meal: 4, name: "Packed Guest", diet: "veg" },
      ],
    });

    const result = await injectJson(app, {
      method: "POST",
      url: "/api/day",
      token: tokenFor(admin),
      payload: { date: "12/6/2026" },
    });

    expect(result.statusCode).toBe(200);
    expect(result.body.status).toBe("prediction");
    expect(result.body.meals.meals[0].map((user) => user._id)).toContain(student._id.toString());
    expect(result.body.meals.packedMeals[0].map((user) => user._id)).toContain(student._id.toString());
    expect(result.body.meals.noMeals.map((user) => user._id)).toContain(noMealStudent._id.toString());
    expect(result.body.meals.meals[1]).toContainEqual({ name: "Lunch Guest", diet: "gf", _id: "_GUEST_Lunch Guest" });
    expect(result.body.meals.packedMeals[1]).toContainEqual({ name: "Packed Guest", diet: "veg", _id: "_GUEST_Packed Guest" });
  });

  it("returns final stored day data for past dates", async () => {
    vi.setSystemTime(new Date("2026-06-10T16:00:00.000Z"));
    const app = await buildTestApp();
    const admin = await createUser({ username: "admin", role: "admin" });
    const student = await createUser({
      username: "student",
      firstName: "Student",
      lastName: "One",
      preferences: { email: 1, skipNotSignedUp: false },
    });
    const skipped = await createUser({
      username: "skipped",
      firstName: "Skipped",
      lastName: "User",
      preferences: { email: 1, skipNotSignedUp: true },
    });

    await createDay({
      date: "1/6/2026",
      meals: [[mealEntryFor(student)], [], []],
      packedMeals: [[], [], []],
      noMeals: [mealEntryFor(skipped)],
      unmarked: [],
      guests: [{ meal: 2, name: "Dinner Guest", diet: "none" }],
    });

    const result = await injectJson(app, {
      method: "POST",
      url: "/api/day",
      token: tokenFor(admin),
      payload: { date: "1/6/2026" },
    });

    expect(result.statusCode).toBe(200);
    expect(result.body.status).toBe("final");
    expect(result.body.meals.meals[0].map((user) => user._id)).toContain(student._id.toString());
    expect(result.body.meals.meals[2]).toContainEqual({ name: "Dinner Guest", diet: "none", _id: "_GUEST_Dinner Guest" });
    expect(result.body.allUsers.map((user) => user.id)).toContain(student._id.toString());
    expect(result.body.allUsers.map((user) => user.id)).not.toContain(skipped._id.toString());
  });

  it("adds guests to a day", async () => {
    vi.setSystemTime(new Date("2026-06-10T16:00:00.000Z"));
    const app = await buildTestApp();
    const admin = await createUser({ username: "admin", role: "admin" });

    const result = await injectJson(app, {
      method: "PATCH",
      url: "/api/day",
      token: tokenFor(admin),
      payload: {
        date: "1/6/2026",
        meal: 4,
        guest: { name: "Packed Guest", diet: "vegetarian" },
      },
    });

    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ code: "ok" });
    const day = await Day.findOne({ date: "1/6/2026" }).lean();
    expect(day.guests).toEqual([{ meal: 4, name: "Packed Guest", diet: "vegetarian" }]);
  });

  it("adds users to stored day meals for dates outside the editable matrix window", async () => {
    vi.setSystemTime(new Date("2026-06-10T16:00:00.000Z"));
    const app = await buildTestApp();
    const admin = await createUser({ username: "admin", role: "admin" });
    const student = await createUser({ username: "student", firstName: "Student", lastName: "One", diet: "vegan" });

    const result = await injectJson(app, {
      method: "PATCH",
      url: "/api/day",
      token: tokenFor(admin),
      payload: {
        date: "1/7/2026",
        meal: "Breakfast",
        users: [student._id.toString()],
      },
    });

    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ code: "ok" });
    const day = await Day.findOne({ date: "1/7/2026" }).lean();
    expect(day.meals[0]).toHaveLength(1);
    expect(day.meals[0][0]).toMatchObject({
      _id: student._id,
      diet: "vegan",
      name: "Student One",
    });
  });

  it("removes guests and normal users from stored days", async () => {
    vi.setSystemTime(new Date("2026-06-10T16:00:00.000Z"));
    const app = await buildTestApp();
    const admin = await createUser({ username: "admin", role: "admin" });
    const studentMeals = buildMeals();
    studentMeals[0][0] = true;
    const student = await createUser({ username: "student", firstName: "Student", lastName: "One", meals: studentMeals });
    await createDay({
      date: "1/6/2026",
      meals: [[mealEntryFor(student)], [], []],
      packedMeals: [[], [], []],
      guests: [{ meal: 1, name: "Lunch Guest", diet: "gf" }],
    });

    const removedGuest = await injectJson(app, {
      method: "POST",
      url: "/api/day/removeUser",
      token: tokenFor(admin),
      payload: { date: "1/6/2026", userID: "_GUEST_Lunch Guest", mealID: 1 },
    });
    expect(removedGuest.statusCode).toBe(200);
    expect(removedGuest.body).toEqual({ success: true });

    const removedUser = await injectJson(app, {
      method: "POST",
      url: "/api/day/removeUser",
      token: tokenFor(admin),
      payload: { date: "1/6/2026", userID: student._id.toString(), mealID: 0 },
    });
    expect(removedUser.statusCode).toBe(200);

    const day = await Day.findOne({ date: "1/6/2026" }).lean();
    expect(day.guests).toEqual([]);
    expect(day.meals[0]).toEqual([]);

    const updatedUser = await User.findById(student._id).lean();
    expect(updatedUser.meals[0][0]).toBe(false);
  });

  it("validates malformed day requests", async () => {
    const app = await buildTestApp();
    const admin = await createUser({ username: "admin", role: "admin" });
    const token = tokenFor(admin);

    const missingDate = await injectJson(app, {
      method: "POST",
      url: "/api/day",
      token,
      payload: {},
    });
    expect(missingDate.statusCode).toBe(400);

    const invalidUsers = await injectJson(app, {
      method: "PATCH",
      url: "/api/day",
      token,
      payload: { date: "1/6/2026", meal: "Breakfast", users: ["not-an-id"] },
    });
    expect(invalidUsers.statusCode).toBe(400);

    const missingDay = await injectJson(app, {
      method: "POST",
      url: "/api/day/removeUser",
      token,
      payload: { date: "1/6/2026", userID: "_GUEST_Missing", mealID: 1 },
    });
    expect(missingDay.statusCode).toBe(404);
  });
});
