import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { findUserByUsername } from "../data/users.js";

export default async function authRoutes(app) {
  app.post("/api/auth", async (request, reply) => {
    const data = request.body || {};
    const username = data.username?.trim().toLowerCase();
    const password = data.password?.trim();

    const user = await findUserByUsername(username, { includeHash: true }).catch(() => null);

    if (!user) return { code: "noUser" };

    const validPassword = await bcrypt.compare(password, user.hash);
    if (!validPassword) return { code: "badPass" };

    if (user.active === false) {
      return reply.code(402).send({
        error: "Your account is not active. Please contact the administrator.",
      });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "30d" },
    );

    return {
      token,
      username: user.username,
      role: user.role,
      preferences: user.preferences,
      device_registered: user.notifications?.device?.token?.length > 0 || false,
    };
  });
}
