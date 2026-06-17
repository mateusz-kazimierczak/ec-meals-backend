import {
  addGuestSignup,
  getDaySummary,
  removeUserFromMeal,
  setMealSignup,
} from "../data/mealStore.js";
import { mealTypeFromLegacy, ALL_MEAL_TYPES } from "../domain/meals.js";

const meals = ["Breakfast", "Lunch", "Dinner", "P1", "P2", "PS"];
const datePattern = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidDateString = (date) => typeof date === "string" && datePattern.test(date);

export default async function dayRoutes(app) {
  app.post("/api/day", async (request, reply) => {
    const body = request.body || {};
    if (!isValidDateString(body.date)) return reply.code(400).send({ message: "Valid date is required" });
    const summary = await getDaySummary(body.date);
    return { ...summary, status: "final" };
  });

  app.patch("/api/day", async (request, reply) => {
    const body = request.body || {};
    if (!isValidDateString(body.date)) return reply.code(400).send({ message: "Valid date is required" });
    if (body.guest) {
      if (!Number.isInteger(body.meal) || body.meal < 0 || body.meal > 5 || !body.guest.name) {
        return reply.code(400).send({ message: "Valid guest and meal are required" });
      }
    } else {
      if (!Array.isArray(body.users) || body.users.some((user) => typeof user !== "string" || !uuidPattern.test(user))) {
        return reply.code(400).send({ message: "Valid users are required" });
      }
      if (!meals.includes(body.meal)) return reply.code(400).send({ message: "Valid meal is required" });
    }

    if (body.guest) {
      await addGuestSignup({
        date: body.date,
        mealType: ALL_MEAL_TYPES[body.meal],
        guest: body.guest,
        actorId: request.user.id,
      });
      return { code: "ok" };
    }

    const mealType = mealTypeFromLegacy(body.meal);
    await Promise.all(body.users.map((userId) => setMealSignup({
      userId,
      date: body.date,
      mealType,
      status: "attending",
      actorId: request.user.id,
      source: "admin",
    })));
    return { code: "ok" };
  });

  app.post("/api/day/removeUser", async (request, reply) => {
    const body = request.body || {};
    if (!isValidDateString(body.date)) return reply.code(400).send({ message: "Valid date is required" });
    if (typeof body.userID !== "string" || !body.userID) return reply.code(400).send({ message: "Valid userID is required" });
    if (!Number.isInteger(body.mealID) || body.mealID < 0 || body.mealID > 5) return reply.code(400).send({ message: "Valid mealID is required" });

    await removeUserFromMeal({
      date: body.date,
      mealType: ALL_MEAL_TYPES[body.mealID],
      userId: body.userID,
      actorId: request.user.id,
    });

    return { success: true };
  });
}
