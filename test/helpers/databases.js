import mongoose from "mongoose";
import { closePostgresPool, ensurePostgresSchema, getPostgresPool } from "../../src/_helpers/postgres.js";

export const connectTestMongo = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
  return mongoose.connection;
};

export const resetTestMongo = async () => {
  await connectTestMongo();
  await mongoose.connection.dropDatabase();
};

export const resetTestPostgres = async () => {
  await ensurePostgresSchema();
  await getPostgresPool().query(`
    TRUNCATE TABLE
      meal_history,
      user_settings_history
    RESTART IDENTITY CASCADE
  `);
};

export const resetTestDatabases = async () => {
  await Promise.all([
    resetTestMongo(),
    resetTestPostgres(),
  ]);
};

export const closeTestDatabases = async () => {
  await Promise.all([
    mongoose.disconnect(),
    closePostgresPool(),
  ]);
};
