import { getSetting as getPostgresSetting } from "../data/settings.js";

export const getSetting = async (key) => {
  return getPostgresSetting(key);
};
