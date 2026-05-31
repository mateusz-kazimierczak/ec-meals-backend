export const dynamic = "force-dynamic";

import connectDB from "@/_helpers/db/connect";
import Activity from "@/_helpers/db/models/Activity";
import {
  MC_KEY, MC_TEMPLATE_ID,
  mcHeaders, mcUrl, buildEmailContent,
} from "@/_helpers/mailchimp";

// GET /api/activities/[id] — read from MongoDB (no Mailchimp call)
export async function GET(req, context) {
  const { id } = context.params;

  await connectDB();
  const activity = await Activity.findOne({ mailchimpId: id }).lean();

  if (!activity) {
    return Response.json({ error: "Activity not found" }, { status: 404 });
  }

  return Response.json({
    id: activity.mailchimpId,
    title: activity.title,
    activityName: activity.activityName,
    activityDate: activity.activityDate,
    status: activity.status,
    sendTime: activity.sendTime || null,
    createTime: activity.createdAt,
    body: activity.body,
  });
}

// PATCH /api/activities/[id] — update Mailchimp content + MongoDB record
export async function PATCH(req, context) {
  const { id } = context.params;
  const { title, body, activityDate, activityName } = await req.json();

  // Update Mailchimp campaign settings
  if (title) {
    await fetch(mcUrl(`/campaigns/${id}`), {
      method: "PATCH",
      headers: mcHeaders(),
      body: JSON.stringify({
        settings: { title: title.trim(), subject_line: title.trim() },
      }),
    });
  }

  // Update Mailchimp content and get fresh rendered HTML
  let html = "";
  if (title && body) {
    const contentRes = await fetch(mcUrl(`/campaigns/${id}/content`), {
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
      return Response.json(
        { error: contentData.detail || "Failed to update content" },
        { status: contentRes.status }
      );
    }
    html = contentData.html || "";
  }

  // Update MongoDB record
  await connectDB();
  const update = {};
  if (title) update.title = title.trim();
  if (body) update.body = body;
  if (activityDate) update.activityDate = new Date(activityDate);
  if (activityName !== undefined) update.activityName = activityName?.trim() || "";

  await Activity.findOneAndUpdate({ mailchimpId: id }, update);

  return Response.json({ ok: true, html });
}

// DELETE /api/activities/[id]
export async function DELETE(req, context) {
  const { id } = context.params;

  const res = await fetch(mcUrl(`/campaigns/${id}`), {
    method: "DELETE",
    headers: mcHeaders(),
  });

  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    return Response.json({ error: err.detail || "Failed to delete" }, { status: res.status });
  }

  await connectDB();
  await Activity.findOneAndDelete({ mailchimpId: id });

  return Response.json({ ok: true });
}
