import { describe, expect, it, vi } from "vitest";
import { Settings } from "../../src/_helpers/db/models/Settings.js";
import { buildTestApp } from "../helpers/app.js";
import { injectJson } from "../helpers/http.js";
import {
  buildMeals,
  createActivity,
  createDay,
  createUser,
  mealEntryFor,
  tokenFor,
} from "../helpers/fixtures.js";

describe("home routes", () => {
  it("returns current and tomorrow meals from the user matrix before update time", async () => {
    vi.setSystemTime(new Date("2026-06-10T10:00:00.000Z"));
    const app = await buildTestApp();
    const meals = buildMeals();
    meals[2] = [true, false, true, false, false, false, false];
    meals[3] = [false, true, false, true, false, false, false];
    const student = await createUser({ username: "student", meals });
    await createDay({
      date: "10/6/2026",
      packedMeals: [[], [mealEntryFor(student)], []],
    });

    const result = await injectJson(app, {
      url: "/api/home/meals",
      token: tokenFor(student),
    });

    expect(result.statusCode).toBe(200);
    expect(result.body.allMealsToday).toEqual([true, false, true, false, true, false]);
    expect(result.body.tomorrowMeals).toEqual(meals[3]);
  });

  it("returns upcoming active-user birthdays sorted by days away", async () => {
    vi.setSystemTime(new Date("2026-06-10T16:00:00.000Z"));
    const app = await buildTestApp();
    const student = await createUser({ username: "student", firstName: "Student", lastName: "Soon", birthdayMonth: 6, birthdayDay: 12 });
    await createUser({ username: "later", firstName: "Later", lastName: "User", birthdayMonth: 6, birthdayDay: 20 });
    await createUser({ username: "past", firstName: "Past", lastName: "User", birthdayMonth: 6, birthdayDay: 1 });
    await createUser({ username: "inactive", active: false, birthdayMonth: 6, birthdayDay: 11 });

    const result = await injectJson(app, {
      url: "/api/home/birthdays",
      token: tokenFor(student),
    });

    expect(result.statusCode).toBe(200);
    expect(result.body.birthdayDisplay.map((item) => item.name)).toEqual(["Student Soon", "Later User"]);
    expect(result.body.birthdayDisplay.map((item) => item.days)).toEqual([2, 10]);
  });

  it("returns breakfast signup list before update time", async () => {
    vi.setSystemTime(new Date("2026-06-10T10:00:00.000Z"));
    const app = await buildTestApp();
    const meals = buildMeals();
    meals[3][0] = true;
    const student = await createUser({ username: "student", firstName: "Student", lastName: "Breakfast", meals, diet: "vegan" });
    await createUser({ username: "inactive", active: false, meals });

    const result = await injectJson(app, {
      url: "/api/home/current_meals",
      token: tokenFor(student),
    });

    expect(result.statusCode).toBe(200);
    expect(result.body.meal).toBe("Breakfast");
    expect(result.body.meals).toHaveLength(1);
    expect(result.body.meals[0]).toMatchObject({
      name: "Student Breakfast",
      id: student._id.toString(),
      diet: "vegan",
    });
  });

  it("returns stored current lunch meals after update time", async () => {
    vi.setSystemTime(new Date("2026-06-10T16:00:00.000Z"));
    const app = await buildTestApp();
    await Settings.create({ _id: "schedule", crons: ["0 8 * * *"] });
    const student = await createUser({ username: "student", firstName: "Student", lastName: "Lunch" });
    await createDay({
      date: "10/6/2026",
      meals: [[], [mealEntryFor(student)], []],
    });

    const result = await injectJson(app, {
      url: "/api/home/current_meals",
      token: tokenFor(student),
    });

    expect(result.statusCode).toBe(200);
    expect(result.body.meal).toBe("Lunch");
    expect(result.body.currHour).toBe(12);
    expect(result.body.meals).toHaveLength(1);
    expect(result.body.meals[0]._id).toBe(student._id.toString());
  });

  it("returns the current activity with first-name replacement", async () => {
    vi.setSystemTime(new Date("2026-06-10T16:00:00.000Z"));
    const app = await buildTestApp();
    const student = await createUser({ username: "student", firstName: "Student" });
    await createActivity({
      title: "Friday Event",
      activityName: "Event",
      activityDate: new Date("2026-06-12T22:00:00.000Z"),
      sendTime: new Date("2026-06-10T12:00:00.000Z"),
      body: "Hello *|FNAME|*, join us.",
    });

    const result = await injectJson(app, {
      url: "/api/home/current-activity",
      token: tokenFor(student),
    });

    expect(result.statusCode).toBe(200);
    expect(result.body.activity).toMatchObject({
      title: "Friday Event",
      activityName: "Event",
      body: "Hello Student, join us.",
    });
  });

  it("returns null when no current activity matches", async () => {
    vi.setSystemTime(new Date("2026-06-10T16:00:00.000Z"));
    const app = await buildTestApp();
    const student = await createUser({ username: "student" });

    const result = await injectJson(app, {
      url: "/api/home/current-activity",
      token: tokenFor(student),
    });

    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ activity: null });
  });
});
