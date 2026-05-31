export const dynamic = "force-dynamic";

import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";
import { mcHeaders, mcUrl } from "@/_helpers/mailchimp";

// POST /api/activities/[id]/test
// Sends a Mailchimp test email for the draft campaign to the logged-in user's email.
// Requires the request to carry a valid JWT (userID injected by middleware).
export async function POST(req, context) {
  const { id } = context.params;

  const userId = req.headers.get("userID");
  if (!userId) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  await connectDB();
  const user = await User.findById(userId).select("email").lean();

  if (!user?.email) {
    return Response.json(
      { error: "No email address found on your account. Ask an admin to add one." },
      { status: 400 }
    );
  }

  const res = await fetch(mcUrl(`/campaigns/${id}/actions/test`), {
    method: "POST",
    headers: mcHeaders(),
    body: JSON.stringify({
      test_emails: [user.email],
      send_type: "html",
    }),
  });

  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    return Response.json(
      { error: err.detail || "Mailchimp test send failed" },
      { status: res.status }
    );
  }

  return Response.json({ ok: true, sentTo: user.email });
}
