// 

import { report } from "process";

export const defaultNotificationPreferences = {
  notificationTypes: {
    email: false
  },
  schema: {
    full_report: Array(7).fill(false),
    meals: Array(7).fill(false),
    packed_meals: Array(7).fill(false),
    any_meals: Array(7).fill(true),
  },
  schedule: {
    morning: Array(7).fill(true),
    noon: Array(7).fill(false),
    evening: Array(7).fill(false),
  },
  report: {
    full_report: Array(7).fill(false),
    report_on_notifications: Array(7).fill(true)
  },
  device: null
};