export const dynamic = "force-dynamic";

import { MC_KEY, mcHeaders, mcUrl } from "@/_helpers/mailchimp";

// POST /api/activities/upload-image
// Body: { name: string, data: string (base64, no data-URI prefix) }
// Returns: { url: string } — the Mailchimp-hosted full_size_url
export async function POST(req) {
  if (!MC_KEY) {
    return Response.json({ error: "Mailchimp not configured" }, { status: 503 });
  }

  const { name, data } = await req.json();

  if (!name || !data) {
    return Response.json({ error: "name and data are required" }, { status: 400 });
  }

  const res = await fetch(mcUrl("/file-manager/files"), {
    method: "POST",
    headers: mcHeaders(),
    body: JSON.stringify({ name, file_data: data }),
  });

  const result = await res.json();

  if (!res.ok) {
    return Response.json(
      { error: result.detail || "Mailchimp upload failed" },
      { status: res.status }
    );
  }

  return Response.json({ url: result.full_size_url });
}
