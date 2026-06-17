import {
  createActivity,
  deleteActivity,
  findActivityByMailchimpId,
  listActivities,
} from "../../../data/activities.js";

const withLean = (loader) => ({
  lean: loader,
  then: (resolve, reject) => loader().then(resolve, reject),
});

export default {
  findOne(filter = {}) {
    return withLean(async () => findActivityByMailchimpId(filter.mailchimpId));
  },
  async countDocuments() {
    return (await listActivities()).length;
  },
  async create(activity) {
    return createActivity(activity);
  },
  async findOneAndDelete(filter = {}) {
    return deleteActivity(filter.mailchimpId);
  },
};
