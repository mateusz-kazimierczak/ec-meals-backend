import moment from "moment-timezone";

export const NORMAL_MEAL_TYPES = ["breakfast", "lunch", "dinner"];
export const PACKED_MEAL_TYPES = ["packed_1", "packed_2", "packed_supper"];
export const ALL_MEAL_TYPES = [...NORMAL_MEAL_TYPES, ...PACKED_MEAL_TYPES];

export const LEGACY_MEAL_LABELS = ["Breakfast", "Lunch", "Dinner", "P1", "P2", "PS"];
export const LEGACY_SHORT_LABELS = ["B", "L", "S", "P1", "P2", "PS", "X"];

export const mealTypeFromLegacy = (meal) => {
  const index = LEGACY_MEAL_LABELS.indexOf(meal);
  return index === -1 ? null : ALL_MEAL_TYPES[index];
};

export const mealTypeIndex = (mealType) => ALL_MEAL_TYPES.indexOf(mealType);

export const torontoDateKey = (date = new Date()) => moment(date).tz("America/Toronto").format("YYYY-MM-DD");

export const dateKeyFromLegacy = (date) => {
  if (typeof date !== "string") return torontoDateKey(date);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const [day, month, year] = date.split("/").map((part) => Number(part));
  return moment.tz({ year, month: month - 1, date: day }, "America/Toronto").format("YYYY-MM-DD");
};

export const legacyDateFromKey = (dateKey) => {
  const date = moment.tz(dateKey, "YYYY-MM-DD", "America/Toronto");
  return `${date.date()}/${date.month() + 1}/${date.year()}`;
};

export const dateKeysForWeek = (start = moment().tz("America/Toronto").startOf("isoWeek")) => (
  Array.from({ length: 7 }, (_, index) => start.clone().add(index, "days").format("YYYY-MM-DD"))
);

export const emptyLegacyMatrix = () => Array.from({ length: 7 }, () => Array(7).fill(false));

export const mealEntry = (user) => ({
  _id: user.id,
  id: user.id,
  name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
  diet: user.diet || null,
});
