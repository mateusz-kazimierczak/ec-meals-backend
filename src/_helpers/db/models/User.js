import { findUserById, listUsers } from "../../../data/users.js";
import { getUserLegacyMatrix } from "../../../data/mealStore.js";

const withLean = (loader) => ({
  lean: loader,
  select: () => withLean(loader),
  sort: () => withLean(loader),
  then: (resolve, reject) => loader().then(resolve, reject),
});

const attachMeals = async (user) => {
  if (!user) return null;
  return { ...user, _id: user.id, meals: await getUserLegacyMatrix(user.id) };
};

export default {
  findById(id) {
    return withLean(async () => attachMeals(await findUserById(id)));
  },
  find(filter = {}) {
    return withLean(async () => {
      let users = await listUsers();
      if (filter._id?.$in) {
        const ids = new Set(filter._id.$in.map(String));
        users = users.filter((user) => ids.has(user.id));
      }
      return Promise.all(users.map(attachMeals));
    });
  },
};
