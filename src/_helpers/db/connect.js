import mongoose from "mongoose";

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export default async function connectDB() {
  const databaseUrl = process.env.MONGODB_URI;
  if (!databaseUrl) {
    throw new Error("Please define the MONGODB_URI environment variable.");
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose
      .connect(databaseUrl, opts)
      .then((mongoose) => {
        console.log("Connected to MongoDB");
        return mongoose;
      });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
