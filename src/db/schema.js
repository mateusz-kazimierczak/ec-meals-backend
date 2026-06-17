import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const diets = pgTable("diets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  ...timestamps,
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  hash: text("hash").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  birthdayMonth: integer("birthday_month"),
  birthdayDay: integer("birthday_day"),
  role: text("role").notNull().default("user"),
  email: text("email"),
  active: boolean("active").notNull().default(true),
  room: integer("room"),
  guest: boolean("guest").notNull().default(false),
  dietId: uuid("diet_id").references(() => diets.id, { onDelete: "set null" }),
  ...timestamps,
});

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  allowNextWeek: boolean("allow_next_week").notNull().default(false),
  persistMeals: boolean("persist_meals").notNull().default(false),
  skipNotSignedUp: boolean("skip_not_signed_up").notNull().default(false),
  ...timestamps,
});

export const notificationPreferences = pgTable("notification_preferences", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  emailEnabled: boolean("email_enabled").notNull().default(false),
  pushEnabled: boolean("push_enabled").notNull().default(false),
  ...timestamps,
});

export const notificationRules = pgTable("notification_rules", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ruleType: text("rule_type").notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  ...timestamps,
});

export const notificationWindows = pgTable("notification_windows", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  window: text("window").notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  ...timestamps,
});

export const notificationDevices = pgTable("notification_devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  deviceName: text("device_name"),
  expoPushToken: text("expo_push_token").notNull(),
  platform: text("platform"),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull().default({}),
  ...timestamps,
});

export const activities = pgTable("activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  mailchimpId: text("mailchimp_id").notNull().unique(),
  title: text("title").notNull(),
  activityName: text("activity_name").notNull().default(""),
  activityDate: timestamp("activity_date", { withTimezone: true }).notNull(),
  sendTime: timestamp("send_time", { withTimezone: true }),
  status: text("status").notNull().default("save"),
  body: text("body").notNull(),
  emailsSent: integer("emails_sent").notNull().default(0),
  ...timestamps,
});

export const mealServices = pgTable("meal_services", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceDate: date("service_date").notNull(),
  mealType: text("meal_type").notNull(),
  cutoffAt: timestamp("cutoff_at", { withTimezone: true }),
  status: text("status").notNull().default("open"),
  ...timestamps,
}, (table) => ({
  serviceDateMealType: unique().on(table.serviceDate, table.mealType),
}));

export const mealSignups = pgTable("meal_signups", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mealServiceId: uuid("meal_service_id").notNull().references(() => mealServices.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("unmarked"),
  source: text("source").notNull().default("user"),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
}, (table) => ({
  userMealService: unique().on(table.userId, table.mealServiceId),
}));

export const dailyNoMeals = pgTable("daily_no_meals", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceDate: date("service_date").notNull(),
  source: text("source").notNull().default("user"),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
});

export const guestSignups = pgTable("guest_signups", {
  id: uuid("id").primaryKey().defaultRandom(),
  mealServiceId: uuid("meal_service_id").notNull().references(() => mealServices.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  diet: text("diet"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
