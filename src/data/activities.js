import { query } from "../db/index.js";

const mapActivity = (row) => row && ({
  id: row.id,
  mailchimpId: row.mailchimp_id,
  title: row.title,
  activityName: row.activity_name,
  activityDate: row.activity_date,
  sendTime: row.send_time,
  status: row.status,
  body: row.body,
  emailsSent: row.emails_sent,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const listActivities = async () => {
  const result = await query("SELECT * FROM activities ORDER BY created_at DESC LIMIT 50");
  return result.rows.map(mapActivity);
};

export const createActivity = async (activity) => {
  await query(`
    INSERT INTO activities (mailchimp_id, title, activity_name, activity_date, send_time, body, status, emails_sent)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
  `, [
    activity.mailchimpId,
    activity.title,
    activity.activityName || "",
    activity.activityDate,
    activity.sendTime || null,
    activity.body,
    activity.status || "save",
    activity.emailsSent ?? 0,
  ]);
  return findActivityByMailchimpId(activity.mailchimpId);
};

export const findActivityByMailchimpId = async (mailchimpId) => {
  const result = await query("SELECT * FROM activities WHERE mailchimp_id = $1", [mailchimpId]);
  return mapActivity(result.rows[0]);
};

export const updateActivity = async (mailchimpId, update) => {
  const sets = [];
  const values = [];
  const add = (column, value) => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };
  if (Object.prototype.hasOwnProperty.call(update, "title")) add("title", update.title);
  if (Object.prototype.hasOwnProperty.call(update, "body")) add("body", update.body);
  if (Object.prototype.hasOwnProperty.call(update, "activityDate")) add("activity_date", update.activityDate);
  if (Object.prototype.hasOwnProperty.call(update, "activityName")) add("activity_name", update.activityName);
  if (Object.prototype.hasOwnProperty.call(update, "status")) add("status", update.status);
  if (Object.prototype.hasOwnProperty.call(update, "sendTime")) add("send_time", update.sendTime);
  if (sets.length === 0) return findActivityByMailchimpId(mailchimpId);
  values.push(mailchimpId);
  await query(`UPDATE activities SET ${sets.join(", ")}, updated_at = NOW() WHERE mailchimp_id = $${values.length}`, values);
  return findActivityByMailchimpId(mailchimpId);
};

export const deleteActivity = async (mailchimpId) => {
  await query("DELETE FROM activities WHERE mailchimp_id = $1", [mailchimpId]);
};
