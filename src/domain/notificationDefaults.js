export const defaultNotificationPreferences = {
  emailEnabled: false,
  pushEnabled: false,
  rules: {
    missingRegularMeals: Array(7).fill(false),
    missingPackedMeals: Array(7).fill(false),
    missingAnyMeals: Array(7).fill(true),
    fullReport: Array(7).fill(false),
    reportOnNotifications: Array(7).fill(true),
  },
  windows: {
    morning: Array(7).fill(true),
    noon: Array(7).fill(false),
    evening: Array(7).fill(false),
  },
  device: null,
};
