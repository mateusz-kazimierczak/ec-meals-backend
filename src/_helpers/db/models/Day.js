import { getDaySummary, getGuestsForDate } from "../../../data/mealStore.js";

const withLean = (loader) => ({
  lean: loader,
  then: (resolve, reject) => loader().then(resolve, reject),
});

export default {
  findOne(filter = {}) {
    return withLean(async () => {
      if (!filter.date) return null;
      const summary = await getDaySummary(filter.date);
      return {
        date: filter.date,
        ...summary.meals,
        guests: await getGuestsForDate(filter.date),
      };
    });
  },
};
