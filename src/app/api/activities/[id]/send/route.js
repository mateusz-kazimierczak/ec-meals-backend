export const dynamic = "force-dynamic";

import connectDB from "@/_helpers/db/connect";
import Activity from "@/_helpers/db/models/Activity";
import { MC_KEY, mcHeaders, mcUrl } from "@/_helpers/mailchimp";

// POST /api/activities/[id]/send
// Body: { schedule_time?: "2025-06-15T14:30:00+00:00" }
// Omit schedule_time to send immediately.
export async function POST(req, context) {
  const { id } = context.params;
  const body = await req.json().catch(() => ({}));
  const { schedule_time } = body;

  const action = schedule_time ? "schedule" : "send";
  const actionBody = schedule_time ? JSON.stringify({ schedule_time }) : undefined;

  const res = await fetch(mcUrl(`/campaigns/${id}/actions/${action}`), {
    method: "POST",
    headers: mcHeaders(),
    body: actionBody,
  });

  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    return Response.json(
      { error: err.detail || `Failed to ${action} campaign` },
      { status: res.status }
    );
  }

  // Update MongoDB status and send time
  await connectDB();
  await Activity.findOneAndUpdate(
    { mailchimpId: id },
    {
      status: schedule_time ? "schedule" : "sent",
      sendTime: schedule_time ? new Date(schedule_time) : new Date(),
    }
  );

  return Response.json({ ok: true, scheduled: !!schedule_time });
}
