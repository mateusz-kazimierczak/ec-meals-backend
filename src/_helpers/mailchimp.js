// Shared Mailchimp Marketing API helpers used by all activities routes.

export const MC_KEY = process.env.MAILCHIMP_API_KEY;
export const MC_LIST_ID = process.env.MAILCHIMP_LIST_ID || "393f346fb8";
// Coded template "EC University Activities Automated - API" (mc:edit="email_content")
export const MC_TEMPLATE_ID = parseInt(process.env.MAILCHIMP_TEMPLATE_ID || "10031874");
export const MC_FROM_NAME = process.env.MAILCHIMP_FROM_NAME || "University Activities Committee";
export const MC_REPLY_TO = process.env.MAILCHIMP_REPLY_TO;

export function mcServer() {
  return MC_KEY?.split("-").pop();
}

export function mcHeaders() {
  return {
    Authorization: `Basic ${Buffer.from(`key:${MC_KEY}`).toString("base64")}`,
    "Content-Type": "application/json",
  };
}

export function mcUrl(path) {
  return `https://${mcServer()}.api.mailchimp.com/3.0${path}`;
}

// The mc:edit="email_content" section receives the rich-HTML body directly.
// The title is used only for the campaign subject line, not injected into the body.
export function buildEmailContent(_title, bodyHtml) {
  return bodyHtml;
}
