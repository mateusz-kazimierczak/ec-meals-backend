import fp from "fastify-plugin";
import * as jose from "jose";
import { getHeader, HttpError } from "../lib/http.js";

const protectedPrefixes = [
  "/api/users/single",
  "/api/meals",
  "/api/preferences",
  "/api/preferences/notifications",
  "/api/preferences/notifications/addDevice",
  "/api/home",
  "/api/home/meals",
  "/api/logs",
];

const adminPrefixes = [
  "/api/day",
  "/api/users/all",
  "/api/users/batch/notifications",
  "/api/diets",
  "/api/settings",
];

const activityEditorPrefixes = ["/api/activities"];

const publicPrefixes = ["/healthz", "/readyz", "/api/auth", "/api/test"];

const matchesPrefix = (path, prefix) => path === prefix || path.startsWith(`${prefix}/`);
const startsWithAny = (path, prefixes) => prefixes.some((prefix) => matchesPrefix(path, prefix));

async function verifyToken(request) {
  const token = getHeader(request, "authorization");
  if (!token) throw new HttpError(401, "invalid Authentication");

  const { payload } = await jose.jwtVerify(
    token,
    new TextEncoder().encode(process.env.JWT_SECRET),
  );

  request.user = {
    id: payload.id,
    role: payload.role,
  };
}

export default fp(async function authPlugin(app) {
  app.decorateRequest("user", null);

  app.decorate("authenticate", async (request) => {
    try {
      await verifyToken(request);
    } catch {
      throw new HttpError(401, "invalid Authentication");
    }
  });

  app.decorate("requireAdmin", async (request) => {
    await app.authenticate(request);
    if (request.user?.role !== "admin") throw new HttpError(401, "Unauthorized");
  });

  app.decorate("requireActivityEditor", async (request) => {
    await app.authenticate(request);
    const role = request.user?.role;
    if (role !== "admin" && role !== "activity_editor") {
      throw new HttpError(401, "Unauthorized");
    }
  });

  app.addHook("preHandler", async (request) => {
    const path = request.url.split("?")[0];
    if (startsWithAny(path, publicPrefixes)) return;

    if (startsWithAny(path, adminPrefixes)) {
      await app.requireAdmin(request);
      return;
    }

    if (startsWithAny(path, activityEditorPrefixes)) {
      await app.requireActivityEditor(request);
      return;
    }

    if (startsWithAny(path, protectedPrefixes)) {
      await app.authenticate(request);
    }
  });
});
