import cors from "@fastify/cors";
import Fastify from "fastify";
import connectDB from "./_helpers/db/connect.js";
import { ensurePostgresSchema } from "./_helpers/postgres.js";
import authPlugin from "./plugins/auth.js";
import { HttpError } from "./lib/http.js";
import authRoutes from "./routes/auth.js";
import mealsRoutes from "./routes/meals.js";
import preferencesRoutes from "./routes/preferences.js";
import usersRoutes from "./routes/users.js";
import dayRoutes from "./routes/day.js";
import homeRoutes from "./routes/home.js";
import adminRoutes from "./routes/admin.js";
import logsRoutes from "./routes/logs.js";
import activitiesRoutes from "./routes/activities.js";
import internalRoutes from "./routes/internal.js";

export function buildApp(options = {}) {
  const app = Fastify({
    logger: options.logger ?? true,
    bodyLimit: 10 * 1024 * 1024,
  });

  app.register(cors, {
    origin: true,
    credentials: true,
    methods: ["GET", "OPTIONS", "PATCH", "DELETE", "POST", "PUT"],
    allowedHeaders: ["*"],
  });

  app.register(authPlugin);

  app.get("/healthz", async () => ({ ok: true }));
  app.get("/readyz", async () => {
    await Promise.all([connectDB(), ensurePostgresSchema()]);
    return { ok: true };
  });

  app.register(authRoutes);
  app.register(mealsRoutes);
  app.register(preferencesRoutes);
  app.register(usersRoutes);
  app.register(dayRoutes);
  app.register(homeRoutes);
  app.register(adminRoutes);
  app.register(logsRoutes);
  app.register(activitiesRoutes);
  app.register(internalRoutes);

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    if (error instanceof HttpError) {
      reply.code(error.statusCode).send({ message: error.message });
      return;
    }

    reply.code(error.statusCode || 500).send({
      message: error.message || "Internal Server Error",
    });
  });

  return app;
}
