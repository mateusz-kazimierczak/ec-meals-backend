import moment from "moment-timezone";
import { logMealChange } from "../_helpers/mealHistory.js";
import { getNextUpdateTime } from "../_helpers/time.js";
import { getSetting } from "../_helpers/settings.js";
import { getHeader } from "../lib/http.js";
import { findUserById } from "../data/users.js";
import { getCalendar, getUserLegacyMatrix, setUserLegacyMatrix } from "../data/mealStore.js";
import { torontoDateKey } from "../domain/meals.js";

const requestedUser = (request, reply) => {
  let forUser = getHeader(request, "forUser");
  if (forUser === "undefined" || !forUser) {
    forUser = request.user.id;
  } else if (request.user.role !== "admin") {
    reply.code(403).send({ message: "Unauthorized" });
    return null;
  }
  return forUser;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function mealsRoutes(app) {
  app.get("/api/meals", async (request, reply) => {
    const forUser = requestedUser(request, reply);
    if (!forUser) return undefined;

    const [data, meals, scheduleSetting] = await Promise.all([
      uuidPattern.test(forUser) ? findUserById(forUser) : Promise.resolve(null),
      uuidPattern.test(forUser) ? getUserLegacyMatrix(forUser) : Promise.resolve(null),
      getSetting("schedule"),
    ]);

    if (!data) return reply.code(404).send({ message: "User not found" });

    const [updateTime, disabledDay] = getNextUpdateTime(scheduleSetting);
    return {
      meals,
      firstName: data.firstName,
      currTime: moment(new Date()).valueOf(),
      updateTime: updateTime.valueOf(),
      disabledDay,
    };
  });

  app.post("/api/meals", async (request, reply) => {
    const forUser = requestedUser(request, reply);
    if (!forUser) return undefined;
    if (!uuidPattern.test(forUser) || !(await findUserById(forUser))) {
      return reply.code(404).send({ message: "User not found" });
    }
    const data = request.body || {};
    const oldMeals = await getUserLegacyMatrix(forUser);
    await setUserLegacyMatrix(forUser, data.meals, {
      actorId: request.user.id,
      source: request.user.id === forUser ? "user" : "admin",
    });

    if (JSON.stringify(oldMeals) !== JSON.stringify(data.meals)) {
      try {
        await logMealChange({
          userId: request.user.id,
          oldMeals,
          newMeals: data.meals,
        });
      } catch (error) {
        request.log.error({ error }, "Postgres meal history insert error");
      }
    }

    return {
      currTime: new Date(),
      updateTime: getNextUpdateTime(),
    };
  });

  app.get("/api/me/meal-calendar", async (request) => {
    const from = request.query?.from || torontoDateKey();
    const to = request.query?.to || moment.tz(from, "YYYY-MM-DD", "America/Toronto").add(6, "days").format("YYYY-MM-DD");
    return { meals: await getCalendar({ userId: request.user.id, from, to }) };
  });
}
