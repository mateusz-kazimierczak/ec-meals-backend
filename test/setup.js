import fs from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeEach, vi } from "vitest";
import { closeTestDatabases, resetTestDatabases } from "./helpers/databases.js";

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
};

loadEnvFile(path.resolve(".env.test.local"));
loadEnvFile(path.resolve(".env.test"));

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = process.env.MONGODB_URI_TEST;
process.env.POSTGRES_URL = process.env.POSTGRES_URL_TEST;

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-secret";
}

process.env.MAILCHIMP_API_KEY ??= "test-mailchimp-key-us1";
process.env.MAILCHIMP_REPLY_TO ??= "activities@example.com";
process.env.MAILCHIMP_LIST_ID ??= "test-list";
process.env.MAILCHIMP_TEMPLATE_ID ??= "123";

if (!process.env.MONGODB_URI || !process.env.POSTGRES_URL) {
  throw new Error("Test database env is missing. Define MONGODB_URI_TEST and POSTGRES_URL_TEST.");
}

beforeEach(async () => {
  vi.restoreAllMocks();
  global.fetch = vi.fn((url) => {
    throw new Error(`Unexpected external fetch in test: ${url}`);
  });
  await resetTestDatabases();
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await closeTestDatabases();
});
