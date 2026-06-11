import moment from "moment-timezone";
import connectDB from "../_helpers/db/connect.js";
import User from "../_helpers/db/models/User.js";
import { logMealChange } from "../_helpers/mealHistory.js";
import { getNextUpdateTime } from "../_helpers/time.js";
import { getSetting } from "../_helpers/settings.js";
import { getHeader } from "../lib/http.js";

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

export default async function mealsRoutes(app) {
  app.get("/api/meals", async (request, reply) => {
    await connectDB();
    const forUser = requestedUser(request, reply);
    if (!forUser) return undefined;

    const [data, scheduleSetting] = await Promise.all([
      User.findById(forUser, "meals firstName"),
      getSetting("schedule"),
    ]);

    if (!data) return reply.code(404).send({ message: "User not found" });

    const [updateTime, disabledDay] = getNextUpdateTime(scheduleSetting);
    return {
      meals: data.meals,
      firstName: data.firstName,
      currTime: moment(new Date()).valueOf(),
      updateTime: updateTime.valueOf(),
      disabledDay,
    };
  });

  app.post("/api/meals", async (request, reply) => {
    await connectDB();
    const forUser = requestedUser(request, reply);
    if (!forUser) return undefined;
    const data = request.body || {};
    const user = await User.findByIdAndUpdate(forUser, { meals: data.meals });

    if (user && JSON.stringify(user.meals) !== JSON.stringify(data.meals)) {
      try {
        await logMealChange({
          userId: request.user.id,
          oldMeals: user.meals,
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
}
