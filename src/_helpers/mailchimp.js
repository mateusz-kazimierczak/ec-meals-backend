// Shared Mailchimp Marketing API helpers used by all activities routes.

export function getMailchimpConfig() {
  const apiKey = process.env.MAILCHIMP_API_KEY;
  const server = apiKey?.split("-").pop();

  return {
    apiKey,
    server,
    listId: process.env.MAILCHIMP_LIST_ID || "393f346fb8",
    // Coded template "EC University Activities Automated - API" (mc:edit="email_content")
    templateId: parseInt(process.env.MAILCHIMP_TEMPLATE_ID || "10031874", 10),
    fromName: process.env.MAILCHIMP_FROM_NAME || "University Activities Committee",
    replyTo: process.env.MAILCHIMP_REPLY_TO,
  };
}

export function hasCampaignConfig(config = getMailchimpConfig()) {
  return Boolean(config.apiKey && config.server && config.replyTo);
}

export function hasUploadConfig(config = getMailchimpConfig()) {
  return Boolean(config.apiKey && config.server);
}

export function mcHeaders(config = getMailchimpConfig()) {
  return {
    Authorization: `Basic ${Buffer.from(`key:${config.apiKey}`).toString("base64")}`,
    "Content-Type": "application/json",
  };
}

export function mcUrl(path, config = getMailchimpConfig()) {
  return `https://${config.server}.api.mailchimp.com/3.0${path}`;
}

// The mc:edit="email_content" section receives the rich-HTML body directly.
// The title is used only for the campaign subject line, not injected into the body.
export function buildEmailContent(_title, bodyHtml) {
  return bodyHtml;
}
