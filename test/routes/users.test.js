import { describe, expect, it } from "vitest";
import { getPostgresPool } from "../../src/_helpers/postgres.js";
import User from "../../src/_helpers/db/models/User.js";
import { buildTestApp } from "../helpers/app.js";
import { injectJson } from "../helpers/http.js";
import { seedUsers, tokenFor, userPassword } from "../helpers/fixtures.js";

describe("user routes", () => {
  it("lets admins list and create users without sending welcome email", async () => {
    const app = await buildTestApp();
    const { admin } = await seedUsers();
    const token = tokenFor(admin);

    const created = await injectJson(app, {
      method: "POST",
      url: "/api/users/single",
      token,
      payload: {
        username: "new-user",
        password: "new-password",
        firstName: "New",
        lastName: "User",
        email: "new-user@example.com",
        role: "student",
        active: true,
        birthday: "12/5",
        sendWelcomeEmail: false,
      },
    });
    expect(created.statusCode).toBe(200);
    expect(created.body).toEqual({ success: true, new: "yes" });

    const listed = await injectJson(app, { url: "/api/users/all", token });
    expect(listed.statusCode).toBe(200);
    expect(listed.body.map((user) => user.username)).toContain("new-user");
  });

  it("lets users read themselves but not other users", async () => {
    const app = await buildTestApp();
    const { student, otherStudent } = await seedUsers();
    const token = tokenFor(student);

    const self = await injectJson(app, {
      url: "/api/users/single",
      token,
    });
    expect(self.statusCode).toBe(200);
    expect(self.body.username).toBe("student");

    const other = await injectJson(app, {
      url: "/api/users/single",
      token,
      headers: { user_id: otherStudent._id.toString() },
    });
    expect(other.statusCode).toBe(402);
  });

  it("lets admins patch users and writes a settings audit row", async () => {
    const app = await buildTestApp();
    const { admin, student } = await seedUsers();

    const patched = await injectJson(app, {
      method: "PATCH",
      url: "/api/users/single",
      token: tokenFor(admin),
      headers: { user_id: student._id.toString() },
      payload: {
        username: "student-updated",
        password: userPassword,
        firstName: "Updated",
        lastName: "Student",
        email: "updated@example.com",
        role: "student",
        active: true,
        guest: false,
        room: 101,
        diet: "vegetarian",
        birthday: "10/6",
      },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.body).toEqual({ success: true });

    const updated = await User.findById(student._id).lean();
    expect(updated.firstName).toBe("Updated");
    expect(updated.username).toBe("student-updated");

    const auditRows = await getPostgresPool().query("SELECT * FROM user_settings_history WHERE target_user_id = $1", [student._id.toString()]);
    expect(auditRows.rows).toHaveLength(1);
    expect(auditRows.rows[0].change_type).toBe("USER_PROFILE_UPDATE");
    expect(auditRows.rows[0].changed_fields).toContain("password");
  });

  it("lets admins delete users", async () => {
    const app = await buildTestApp();
    const { admin, student } = await seedUsers();

    const deleted = await injectJson(app, {
      method: "DELETE",
      url: "/api/users/single",
      token: tokenFor(admin),
      headers: { user_id: student._id.toString() },
    });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.body).toEqual({ success: true });
    expect(await User.findById(student._id)).toBeNull();
  });
});
