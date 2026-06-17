import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

const { Pool } = pg;

let pool;
let db;
let schemaReady = false;

const requiredDatabaseUrl = () => {
  const databaseUrl = process.env.POSTGRES_URL;
  if (!databaseUrl) {
    throw new Error("Please define the POSTGRES_URL environment variable.");
  }
  return databaseUrl;
};

export const getPostgresPool = () => {
  if (!pool) {
    pool = new Pool({
      connectionString: requiredDatabaseUrl(),
      max: Number(process.env.POSTGRES_POOL_SIZE || 10),
    });
  }
  return pool;
};

export const getDb = () => {
  if (!db) db = drizzle(getPostgresPool(), { schema });
  return db;
};

export const ensurePostgresSchema = async () => {
  if (schemaReady) return;
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const migration = fs.readFileSync(path.resolve(dirname, "../../drizzle/0001_postgres_source_of_truth.sql"), "utf8");
  await getPostgresPool().query(migration);
  schemaReady = true;
};

export const query = async (text, params) => {
  await ensurePostgresSchema();
  return getPostgresPool().query(text, params);
};

export const closePostgresPool = async () => {
  if (!pool) return;
  await pool.end();
  pool = null;
  db = null;
  schemaReady = false;
};
