import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import connectDB from "../_helpers/db/connect.js";
import User from "../_helpers/db/models/User.js";

export default async function authRoutes(app) {
  app.post("/api/auth", async (request, reply) => {
    try {
      await connectDB();
    } catch (error) {
      return reply.code(500).send({ error: error.message });
    }

    const data = request.body || {};
    const username = data.username?.trim().toLowerCase();
    const password = data.password?.trim();

    const user = await User.findOne({ username })
      .select("hash username active role preferences notifications")
      .catch(() => null);

    if (!user) return { code: "noUser" };

    const validPassword = await bcrypt.compare(password, user.hash);
    if (!validPassword) return { code: "badPass" };

    if (user.active === false) {
      return reply.code(402).send({
        error: "Your account is not active. Please contact the administrator.",
      });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
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
