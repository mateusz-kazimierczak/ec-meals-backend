import initAdmin from "../_helpers/db/initAdmin.js";
import connectDB from "../_helpers/db/connect.js";
import User from "../_helpers/db/models/User.js";
import { sendWelcomeEmail } from "../_helpers/emails.jsx";
import { defaultNotificationPreferences } from "../domain/notificationDefaults.js";

const requireInternalSecret = (request, reply) => {
  const expected = process.env.INTERNAL_API_SECRET;
  if (!expected) {
    request.log.error("INTERNAL_API_SECRET is not configured");
    reply.code(503).send({ message: "Internal API is not configured" });
    return false;
  }
  if (request.headers["x-internal-secret"] === expected) return true;
  reply.code(401).send({ message: "Unauthorized" });
  return false;
};

export default async function internalRoutes(app) {
  app.get("/api/internal/init", async (request, reply) => {
    if (!requireInternalSecret(request, reply)) return undefined;
    const result = await initAdmin();
    return { message: result.created ? "Admin user created" : "Admin user already present" };
  });

  app.get("/api/setup", async (request, reply) => {
    if (!requireInternalSecret(request, reply)) return undefined;
    const result = await initAdmin();
    const users = await User.find();
    return { message: result.created ? "Admin created!" : "Admin already present!", users };
  });

  app.get("/api/internal/tasks/add_notifications_preferences_to_all_users", async (request, reply) => {
    if (!requireInternalSecret(request, reply)) return undefined;
    await connectDB();
    const users = await User.find({}, "_id firstName notifications");
    await Promise.all(users.map(async (user) => {
      user.notifications = defaultNotificationPreferences;
      user.markModified("notifications");
      await user.save();
    }));
    return { message: "Added default notifications preferences to all users" };
  });

  app.get("/api/internal/welcomeEmail", async (request, reply) => {
    if (!requireInternalSecret(request, reply)) return undefined;
    await sendWelcomeEmail(
      { email: "mateusz.alicante@gmail.com", firstName: "Test", username: "test" },
      "test",
    );
    return { message: "Hello World!" };
  });

  app.get("/api/test", async () => ({ message: "Hello World!" }));
}
