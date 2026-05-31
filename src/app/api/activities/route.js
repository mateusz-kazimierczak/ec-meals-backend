export const dynamic = "force-dynamic";

import connectDB from "@/_helpers/db/connect";
import Activity from "@/_helpers/db/models/Activity";
import {
  MC_KEY, MC_LIST_ID, MC_TEMPLATE_ID, MC_FROM_NAME, MC_REPLY_TO,
  mcHeaders, mcUrl, buildEmailContent,
} from "@/_helpers/mailchimp";

// GET /api/activities — list all activities from MongoDB
export async function GET() {
  await connectDB();

  const activities = await Activity.find({})
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const campaigns = activities.map((a) => ({
    id: a.mailchimpId,
    title: a.title,
    activityName: a.activityName,
    activityDate: a.activityDate,
    status: a.status,
    sendTime: a.sendTime || null,
    createTime: a.createdAt,
    emailsSent: a.emailsSent || 0,
  }));

  return Response.json({ campaigns });
}

// POST /api/activities — create draft campaign (Mailchimp + MongoDB)
export async function POST(req) {
  if (!MC_KEY || !MC_REPLY_TO) {
    return Response.json(
      { error: "Missing MAILCHIMP_API_KEY or MAILCHIMP_REPLY_TO in environment" },
      { status: 503 }
    );
  }

  const { title, body, activityDate, activityName } = await req.json();

  if (!title?.trim() || !body?.trim() || !activityDate) {
    return Response.json({ error: "Title, body, and activityDate are required" }, { status: 400 });
  }

  // 1. Create Mailchimp campaign
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

  if (!createRes.ok) {
    return Response.json(
      { error: campaign.detail || "Failed to create campaign" },
      { status: createRes.status }
    );
  }

  // 2. Set template content
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
    await fetch(mcUrl(`/campaigns/${campaign.id}`), {
      method: "DELETE",
      headers: mcHeaders(),
    });
    return Response.json(
      { error: contentData.detail || "Failed to set campaign content" },
      { status: contentRes.status }
    );
  }

  // 3. Save to MongoDB
  await connectDB();
  await Activity.create({
    mailchimpId: campaign.id,
    title: title.trim(),
    activityName: activityName?.trim() || "",
    activityDate: new Date(activityDate),
    body,
    status: "save",
  });

  return Response.json({
    id: campaign.id,
    status: campaign.status,
    html: contentData.html || "",
  });
}
