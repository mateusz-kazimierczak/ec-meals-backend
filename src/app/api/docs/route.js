const { google } = require("googleapis");

// generate a url that asks permissions for Google Docs scope
const scopes = ["https://www.googleapis.com/auth/documents"];
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Prints the title of a sample doc:
 * https://docs.google.com/document/d/195j9eDD3ccgjQRttHhJPymLJUCOUjs-jmwTrekvdjFE/edit
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth 2.0 client.
 */
async function printDocTitle(auth) {
  const docs = google.docs({ version: "v1", auth });
  const res = await docs.documents.get({
    documentId: "195j9eDD3ccgjQRttHhJPymLJUCOUjs-jmwTrekvdjFE",
  });
  console.log(`The title of the document is: ${res.data.title}`);
}

authorize().then(printDocTitle).catch(console.error);

export async function GET(req, res) {
  const auth = new google.auth.oauth2Client({});

  const docs = google.docs({ version: "v1", auth: oauth2Client });

  const createDoc = async () => {
    const response = await docs.documents.create();
    console.log(`Created new document with ID: ${response.data.documentId}`);
  };

  createDoc().catch(console.error);
}
