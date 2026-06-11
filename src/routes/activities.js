import connectDB from "../_helpers/db/connect.js";
import Activity from "../_helpers/db/models/Activity.js";
import User from "../_helpers/db/models/User.js";
import {
  MC_KEY,
  MC_LIST_ID,
  MC_TEMPLATE_ID,
  MC_FROM_NAME,
  MC_REPLY_TO,
  mcHeaders,
  mcUrl,
  buildEmailContent,
} from "../_helpers/mailchimp.js";

export default async function activitiesRoutes(app) {
  app.get("/api/activities", async () => {
    await connectDB();
    const activities = await Activity.find({}).sort({ createdAt: -1 }).limit(50).lean();
    return {
      campaigns: activities.map((activity) => ({
        id: activity.mailchimpId,
        title: activity.title,
        activityName: activity.activityName,
        activityDate: activity.activityDate,
        status: activity.status,
        sendTime: activity.sendTime || null,
        createTime: activity.createdAt,
        emailsSent: activity.emailsSent || 0,
      })),
    };
  });

  app.post("/api/activities", async (request, reply) => {
    if (!MC_KEY || !MC_REPLY_TO) {
      return reply.code(503).send({ error: "Missing MAILCHIMP_API_KEY or MAILCHIMP_REPLY_TO in environment" });
    }

    const { title, body, activityDate, activityName } = request.body || {};
    if (!title?.trim() || !body?.trim() || !activityDate) {
      return reply.code(400).send({ error: "Title, body, and activityDate are required" });
    }

    const createRes = await fetch(mcUrl("/campaigns"), {
      method: "POST",
      headers: mcHeaders(),
      body: JSON.stringify({
        type: "regular",
        recipients: { list_id: MC_LIST_ID },
        settings: {
          subject_line: title.trim(),
          title: title.trim(),
          from_name: MC_FROM_NAME,
          reply_to: MC_REPLY_TO,
        },
      }),
    });
    const campaign = await createRes.json();
    if (!createRes.ok) return reply.code(createRes.status).send({ error: campaign.detail || "Failed to create campaign" });

    const contentRes = await fetch(mcUrl(`/campaigns/${campaign.id}/content`), {
      method: "PUT",
      headers: mcHeaders(),
      body: JSON.stringify({
        template: {
          id: MC_TEMPLATE_ID,
          sections: { email_content: buildEmailContent(title.trim(), body) },
        },
      }),
    });
    const contentData = await contentRes.json();
    if (!contentRes.ok) {
      await fetch(mcUrl(`/campaigns/${campaign.id}`), { method: "DELETE", headers: mcHeaders() });
      return reply.code(contentRes.status).send({ error: contentData.detail || "Failed to set campaign content" });
    }

    await connectDB();
    await Activity.create({
      mailchimpId: campaign.id,
      title: title.trim(),
      activityName: activityName?.trim() || "",
      activityDate: new Date(activityDate),
      body,
      status: "save",
    });

    return { id: campaign.id, status: campaign.status, html: contentData.html || "" };
  });

  app.post("/api/activities/upload-image", async (request, reply) => {
    if (!MC_KEY) return reply.code(503).send({ error: "Mailchimp not configured" });

    const { name, data } = request.body || {};
    if (!name || !data) return reply.code(400).send({ error: "name and data are required" });

    const res = await fetch(mcUrl("/file-manager/files"), {
      method: "POST",
      headers: mcHeaders(),
      body: JSON.stringify({ name, file_data: data }),
    });
    const result = await res.json();
    if (!res.ok) return reply.code(res.status).send({ error: result.detail || "Mailchimp upload failed" });

    return { url: result.full_size_url };
  });

  app.get("/api/activities/:id", async (request, reply) => {
    await connectDB();
    const activity = await Activity.findOne({ mailchimpId: request.params.id }).lean();
    if (!activity) return reply.code(404).send({ error: "Activity not found" });

    return {
      id: activity.mailchimpId,
      title: activity.title,
      activityName: activity.activityName,
      activityDate: activity.activityDate,
      status: activity.status,
      sendTime: activity.sendTime || null,
      createTime: activity.createdAt,
      body: activity.body,
    };
  });

  app.patch("/api/activities/:id", async (request, reply) => {
    const { id } = request.params;
    const { title, body, activityDate, activityName } = request.body || {};

    if (title) {
      await fetch(mcUrl(`/campaigns/${id}`), {
        method: "PATCH",
        headers: mcHeaders(),
        body: JSON.stringify({ settings: { title: title.trim(), subject_line: title.trim() } }),
      });
    }

    let html = "";
    if (title && body) {
      const contentRes = await fetch(mcUrl(`/campaigns/${id}/content`), {
        method: "PUT",
        headers: mcHeaders(),
        body: JSON.stringify({
          template: { id: MC_TEMPLATE_ID, sections: { email_content: buildEmailContent(title.trim(), body) } },
        }),
      });
      const contentData = await contentRes.json();
      if (!contentRes.ok) return reply.code(contentRes.status).send({ error: contentData.detail || "Failed to update content" });
      html = contentData.html || "";
    }

    await connectDB();
    const update = {};
    if (title) update.title = title.trim();
    if (body) update.body = body;
    if (activityDate) update.activityDate = new Date(activityDate);
    if (activityName !== undefined) update.activityName = activityName?.trim() || "";
    await Activity.findOneAndUpdate({ mailchimpId: id }, update);

    return { ok: true, html };
  });

  app.delete("/api/activities/:id", async (request, reply) => {
    const { id } = request.params;
    const res = await fetch(mcUrl(`/campaigns/${id}`), { method: "DELETE", headers: mcHeaders() });
    if (!res.ok && res.status !== 204) {
      const error = await res.json().catch(() => ({}));
      return reply.code(res.status).send({ error: error.detail || "Failed to delete" });
    }

    await connectDB();
    await Activity.findOneAndDelete({ mailchimpId: id });
    return { ok: true };
  });

  app.post("/api/activities/:id/send", async (request, reply) => {
    const { schedule_time } = request.body || {};
    const action = schedule_time ? "schedule" : "send";
    const res = await fetch(mcUrl(`/campaigns/${request.params.id}/actions/${action}`), {
      method: "POST",
      headers: mcHeaders(),
      body: schedule_time ? JSON.stringify({ schedule_time }) : undefined,
    });

    if (!res.ok && res.status !== 204) {
      const error = await res.json().catch(() => ({}));
      return reply.code(res.status).send({ error: error.detail || `Failed to ${action} campaign` });
    }

    await connectDB();
    await Activity.findOneAndUpdate(
      { mailchimpId: request.params.id },
      { status: schedule_time ? "schedule" : "sent", sendTime: schedule_time ? new Date(schedule_time) : new Date() },
    );

    return { ok: true, scheduled: !!schedule_time };
  });

  app.post("/api/activities/:id/test", async (request, reply) => {
    await connectDB();
    const user = await User.findById(request.user.id).select("email").lean();
    if (!user?.email) {
      return reply.code(400).send({ error: "No email address found on your account. Ask an admin to add one." });
    }

    const res = await fetch(mcUrl(`/campaigns/${request.params.id}/actions/test`), {
      method: "POST",
      headers: mcHeaders(),
      body: JSON.stringify({ test_emails: [user.email], send_type: "html" }),
    });

    if (!res.ok && res.status !== 204) {
      const error = await res.json().catch(() => ({}));
      return reply.code(res.status).send({ error: error.detail || "Mailchimp test send failed" });
    }

    return { ok: true, sentTo: user.email };
  });
}
