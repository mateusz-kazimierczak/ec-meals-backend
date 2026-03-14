import { unstable_cache } from "next/cache";
import connectDB from "./db/connect";
import { Settings } from "./db/models/Settings";

export const getSetting = unstable_cache(
  async (key) => {
    await connectDB();
    const doc = await Settings.findById(key).lean();
    return doc ?? null;
  },
  ["setting"],
  { tags: ["settings"] },
);
