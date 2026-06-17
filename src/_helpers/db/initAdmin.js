import { countAdmins, createUser } from "../../data/users.js";

export default async function initAdmin() {
  const count = await countAdmins();
  if (count > 0) {
    return { created: false };
  }

  const password = process.env.ADMIN_PASSWORD || "admin";
  await createUser({
    username: process.env.ADMIN_USERNAME || "admin",
    password,
    firstName: "admin",
    lastName: "admin",
    role: "admin",
    email: process.env.ADMIN_EMAIL || undefined,
  });
  return { created: true };
}
