import { getHeader } from "../lib/http.js";
import { getMealHistoryRows } from "../_helpers/mealHistory.js";
import { getUserSettingsAuditRows } from "../_helpers/userSettingsAudit.js";

const logRange = (weekHeader) => {
  const weeksInPast = Number(weekHeader || 1) - 1;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - weeksInPast * 7 - 7);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - weeksInPast * 7 + 1);
  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };
};

const requestedUser = (request, reply) => {
  const role = request.user?.role;
  let forUser = getHeader(request, "forUser");

  if (forUser === "undefined" || !forUser) {
    forUser = request.user.id;
  } else if (role !== "admin") {
    reply.code(403).send({ message: "Unauthorized" });
    return null;
  }

  return forUser;
};

export default async function logsRoutes(app) {
  app.get("/api/logs", async (request, reply) => {
    const forUser = requestedUser(request, reply);
    if (!forUser) return undefined;

    const { startDate, endDate } = logRange(getHeader(request, "week"));

    try {
      const rows = await getMealHistoryRows({ userId: forUser, startDate, endDate });
      return { logs: rows };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: "Failed to fetch logs" });
    }
  });

  app.get("/api/logs/userSettings", async (request, reply) => {
    const forUser = requestedUser(request, reply);
    if (!forUser) return undefined;

    const { startDate, endDate } = logRange(getHeader(request, "week"));

    try {
      const rows = await getUserSettingsAuditRows({ userId: forUser, startDate, endDate });
      return { logs: rows };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: "Failed to fetch settings history" });
    }
  });
}
