import { describe, expect, it } from "vitest";
import Activity from "../../src/_helpers/db/models/Activity.js";
import { buildTestApp } from "../helpers/app.js";
import { mockMailchimp } from "../helpers/externalMocks.js";
import { createActivity, createUser, tokenFor } from "../helpers/fixtures.js";
import { injectJson } from "../helpers/http.js";

describe("activity routes", () => {
  it("creates a Mailchimp campaign and persists the activity", async () => {
    const app = await buildTestApp();
    const editor = await createUser({ username: "editor", role: "activity_editor" });
    const fetchMock = mockMailchimp();

    const result = await injectJson(app, {
      method: "POST",
      url: "/api/activities",
      token: tokenFor(editor),
      payload: {
        title: " New Activity ",
        body: "<p>Hello</p>",
        activityName: " Friday Night ",
        activityDate: "2026-06-12T22:00:00.000Z",
      },
    });

    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ id: "campaign-1", status: "save", html: "<p>Rendered</p>" });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const activity = await Activity.findOne({ mailchimpId: "campaign-1" }).lean();
    expect(activity).toMatchObject({
      title: "New Activity",
      activityName: "Friday Night",
      body: "<p>Hello</p>",
      status: "save",
    });
  });

  it("rolls back campaign creation when content update fails", async () => {
    const app = await buildTestApp();
    const editor = await createUser({ username: "editor", role: "activity_editor" });
    const fetchMock = mockMailchimp({ failContent: true });

    const result = await injectJson(app, {
      method: "POST",
      url: "/api/activities",
      token: tokenFor(editor),
      payload: {
        title: "Activity",
        body: "<p>Hello</p>",
        activityDate: "2026-06-12T22:00:00.000Z",
      },
    });

    expect(result.statusCode).toBe(500);
    expect(result.body).toEqual({ error: "content failed" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.calls.map((call) => call.method)).toEqual(["POST", "PUT", "DELETE"]);
    expect(await Activity.countDocuments()).toBe(0);
  });

  it("uploads images through mocked Mailchimp and surfaces failures", async () => {
    const app = await buildTestApp();
    const editor = await createUser({ username: "editor", role: "activity_editor" });
    mockMailchimp();

    const uploaded = await injectJson(app, {
      method: "POST",
      url: "/api/activities/upload-image",
      token: tokenFor(editor),
      payload: { name: "image.png", data: "base64-data" },
    });
    expect(uploaded.statusCode).toBe(200);
    expect(uploaded.body).toEqual({ url: "https://cdn.example.com/image.png" });

    mockMailchimp({ failUpload: true });
    const failed = await injectJson(app, {
      method: "POST",
      url: "/api/activities/upload-image",
      token: tokenFor(editor),
      payload: { name: "image.png", data: "base64-data" },
    });
    expect(failed.statusCode).toBe(400);
    expect(failed.body).toEqual({ error: "upload failed" });
  });

  it("gets and patches activities", async () => {
    const app = await buildTestApp();
    const editor = await createUser({ username: "editor", role: "activity_editor" });
    await createActivity({ mailchimpId: "campaign-1", title: "Old title", body: "Old body" });
    mockMailchimp();

    const loaded = await injectJson(app, {
      url: "/api/activities/campaign-1",
      token: tokenFor(editor),
    });
    expect(loaded.statusCode).toBe(200);
    expect(loaded.body).toMatchObject({ id: "campaign-1", title: "Old title", body: "Old body" });

    const patched = await injectJson(app, {
      method: "PATCH",
      url: "/api/activities/campaign-1",
      token: tokenFor(editor),
      payload: {
        title: "Updated title",
        body: "Updated body",
        activityName: "Updated name",
        activityDate: "2026-06-13T22:00:00.000Z",
      },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.body).toEqual({ ok: true, html: "<p>Rendered</p>" });

    const activity = await Activity.findOne({ mailchimpId: "campaign-1" }).lean();
    expect(activity).toMatchObject({
      title: "Updated title",
      body: "Updated body",
      activityName: "Updated name",
    });
  });

  it("deletes activities locally after mocked Mailchimp delete", async () => {
    const app = await buildTestApp();
    const editor = await createUser({ username: "editor", role: "activity_editor" });
    await createActivity({ mailchimpId: "campaign-1" });
    mockMailchimp();

    const deleted = await injectJson(app, {
      method: "DELETE",
      url: "/api/activities/campaign-1",
      token: tokenFor(editor),
    });

    expect(deleted.statusCode).toBe(200);
    expect(deleted.body).toEqual({ ok: true });
    expect(await Activity.findOne({ mailchimpId: "campaign-1" })).toBeNull();
  });

  it("sends, schedules, and test-sends campaigns through mocked Mailchimp", async () => {
    const app = await buildTestApp();
    const editor = await createUser({ username: "editor", role: "activity_editor", email: "editor@example.com" });
    await createActivity({ mailchimpId: "campaign-1", status: "save" });
    mockMailchimp();

    const sent = await injectJson(app, {
      method: "POST",
      url: "/api/activities/campaign-1/send",
      token: tokenFor(editor),
      payload: {},
    });
    expect(sent.statusCode).toBe(200);
    expect(sent.body).toEqual({ ok: true, scheduled: false });
    expect((await Activity.findOne({ mailchimpId: "campaign-1" }).lean()).status).toBe("sent");

    const scheduleTime = "2026-06-12T20:00:00.000Z";
    const scheduled = await injectJson(app, {
      method: "POST",
      url: "/api/activities/campaign-1/send",
      token: tokenFor(editor),
      payload: { schedule_time: scheduleTime },
    });
    expect(scheduled.statusCode).toBe(200);
    expect(scheduled.body).toEqual({ ok: true, scheduled: true });
    expect((await Activity.findOne({ mailchimpId: "campaign-1" }).lean()).status).toBe("schedule");

    const testSent = await injectJson(app, {
      method: "POST",
      url: "/api/activities/campaign-1/test",
      token: tokenFor(editor),
    });
    expect(testSent.statusCode).toBe(200);
    expect(testSent.body).toEqual({ ok: true, sentTo: "editor@example.com" });
  });
});
