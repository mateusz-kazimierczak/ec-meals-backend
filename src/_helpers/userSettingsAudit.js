import { BigQuery } from "@google-cloud/bigquery";

export const BQ_DATASET = "meal_history";
export const USER_SETTINGS_BQ_TABLE = "USER_SETTINGS_HISTORY";

const USER_SETTINGS_TABLE_SCHEMA = [
  { name: "CHANGE_TIME", type: "TIMESTAMP", mode: "NULLABLE" },
  { name: "ACTOR_USER_ID", type: "STRING", mode: "NULLABLE" },
  { name: "ACTOR_ROLE", type: "STRING", mode: "NULLABLE" },
  { name: "TARGET_USER_ID", type: "STRING", mode: "NULLABLE" },
  { name: "CHANGE_TYPE", type: "STRING", mode: "NULLABLE" },
  { name: "IS_BATCH", type: "BOOL", mode: "NULLABLE" },
  { name: "CHANGED_FIELDS", type: "STRING", mode: "NULLABLE" },
  { name: "OLD_VALUES", type: "STRING", mode: "NULLABLE" },
  { name: "NEW_VALUES", type: "STRING", mode: "NULLABLE" },
  { name: "METADATA", type: "STRING", mode: "NULLABLE" },
  { name: "REQUEST_PATH", type: "STRING", mode: "NULLABLE" },
  { name: "USER_AGENT", type: "STRING", mode: "NULLABLE" },
];

let bqClient;
let userSettingsTableReady = false;

const normalizeValue = (value) => {
  if (value === undefined) {
    return null;
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch (err) {
    return String(value);
  }
};

const ensureBqClient = () => {
  if (bqClient) return bqClient;

  const credentialsEnv = process.env.GCP_AUTH;
  if (!credentialsEnv) {
    return null;
  }

  let credentials;
  try {
    credentials = JSON.parse(credentialsEnv);
  } catch (error) {
    console.error("Invalid GCP_AUTH JSON payload for audit logging:", error.message);
    return null;
  }

  bqClient = new BigQuery({ projectId: "ec-meals-462913", credentials });
  return bqClient;
};

const ensureUserSettingsTable = async () => {
  if (userSettingsTableReady) return;

  const client = ensureBqClient();
  if (!client) return;

  const table = client.dataset(BQ_DATASET).table(USER_SETTINGS_BQ_TABLE);

  try {
    await table.get();
  } catch (error) {
    if (error.code !== 404) {
      throw error;
    }

    try {
      await client.dataset(BQ_DATASET).createTable(USER_SETTINGS_BQ_TABLE, {
        schema: USER_SETTINGS_TABLE_SCHEMA,
        timePartitioning: {
          type: "DAY",
          field: "CHANGE_TIME",
        },
      });
    } catch (createError) {
      console.error("Failed to create USER_SETTINGS_HISTORY table:", createError.message);
      throw createError;
    }
  }

  userSettingsTableReady = true;
};

export const buildAuditRowDiff = (before, after, fields) => {
  const changedFields = [];
  const oldValues = {};
  const newValues = {};

  fields.forEach((field) => {
    const beforeVal = normalizeValue(before?.[field]);
    const afterVal = normalizeValue(after?.[field]);

    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      changedFields.push(field);
      oldValues[field] = beforeVal;
      newValues[field] = afterVal;
    }
  });

  return {
    changedFields,
    oldValues,
    newValues,
  };
};

export const logUserSettingsChange = async ({
  actorUserId,
  actorRole,
  targetUserId,
  changeType,
  changedFields,
  oldValues,
  newValues,
  metadata = {},
  isBatch = false,
  requestPath = null,
  userAgent = null,
}) => {
  const client = ensureBqClient();
  if (!client) {
    return;
  }

  if (!targetUserId || !Array.isArray(changedFields) || changedFields.length === 0) {
    return;
  }

  try {
    await ensureUserSettingsTable();
  } catch (error) {
    console.error("BigQuery settings audit table check failed:", error.message);
    return;
  }

  const row = {
    CHANGE_TIME: new Date(),
    ACTOR_USER_ID: actorUserId || null,
    ACTOR_ROLE: actorRole || null,
    TARGET_USER_ID: targetUserId,
    CHANGE_TYPE: changeType,
    IS_BATCH: isBatch,
    CHANGED_FIELDS: JSON.stringify(changedFields),
    OLD_VALUES: JSON.stringify(normalizeValue(oldValues)),
    NEW_VALUES: JSON.stringify(normalizeValue(newValues)),
    METADATA: JSON.stringify(normalizeValue(metadata)),
    REQUEST_PATH: requestPath,
    USER_AGENT: userAgent,
  };

  try {
    await client.dataset(BQ_DATASET).table(USER_SETTINGS_BQ_TABLE).insert([row]);
  } catch (error) {
    console.error("Failed to write user settings audit row:", error.message);
  }
};

export const getUserSettingsAuditRows = async ({
  userId,
  startDate,
  endDate,
}) => {
  const client = ensureBqClient();
  if (!client) {
    return [];
  }

  const query = `
    SELECT *
    FROM \`ec-meals-462913.meal_history.${USER_SETTINGS_BQ_TABLE}\`
    WHERE TARGET_USER_ID = @user_id
    AND CHANGE_TIME BETWEEN @start_date AND @end_date
    ORDER BY CHANGE_TIME DESC
  `;

  const [rows] = await client.query({
    query,
    params: {
      user_id: userId,
      start_date: startDate,
      end_date: endDate,
    },
    location: "US",
  });

  return rows;
};
