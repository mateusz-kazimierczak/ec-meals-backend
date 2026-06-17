import { upsertSetting } from "../../../data/settings.js";

export const Settings = {
  async create(body) {
    return upsertSetting(body);
  },
};
