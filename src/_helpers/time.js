export const NDS_TIMEZONE_CONSTANT = -4;
export const DS_TIMEZONE_CONSTANT = -5;

import moment from "moment-timezone";
import { CronExpressionParser } from "cron-parser";

/**
 * Given a moment date and a list of cron strings, return { hour, minute } for
 * the cron that applies to that day of week, or null if none match.
 * Falls back to process.env.UPDATE_TIME[_WEEKEND] if no crons list provided.
 */
const getUpdateTimeForDay = (date, crons) => {
  if (crons && crons.length > 0) {
    // Start of the given day in Toronto time — used as the iteration start for each cron
    const startOfDay = date.clone().startOf("day").toDate();
    for (const cron of crons) {
      try {
        const expr = CronExpressionParser.parse(cron, { currentDate: startOfDay, tz: "America/Toronto" });
        const next = expr.next().toDate();
        const nextMoment = moment(next).tz("America/Toronto");
        // If the next occurrence falls on the same calendar day, this cron covers today
        if (nextMoment.isSame(date, "day")) {
          return { hour: nextMoment.hour(), minute: nextMoment.minute() };
        }
      } catch (e) {
        console.log(`[getUpdateTimeForDay] parse error for cron="${cron}":`, e.message);
      }
    }
    return null;
  }
  // Legacy fallback: HHMM env vars
  const timeStr = (date.day() === 0 || date.day() === 6)
    ? (process.env.UPDATE_TIME_WEEKEND ?? process.env.UPDATE_TIME)
    : process.env.UPDATE_TIME;
  if (!timeStr) return null;
  return { hour: parseInt(timeStr.slice(0, 2)), minute: parseInt(timeStr.slice(2)) };
};

export const getNextUpdateTime = (settings) => { // Fixed
  let disabledDayIndex;
  const now = new Date();
  const nextUpdateTime = moment().tz("America/Toronto");

  const todayTime = getUpdateTimeForDay(nextUpdateTime, settings?.crons);
  if (todayTime) {
    nextUpdateTime.set({ hour: todayTime.hour, minute: todayTime.minute, second: 0 });
  }

  if (isBeforeUpdateTime(now, settings)) {
    const prevDay = nextUpdateTime.clone().add(-1, "days");
    disabledDayIndex = getAppDayIndex(prevDay);
  } else {
    disabledDayIndex = getAppDayIndex(nextUpdateTime);
    nextUpdateTime.add(1, "days");
    const tomorrowTime = getUpdateTimeForDay(nextUpdateTime, settings?.crons);
    if (tomorrowTime) {
      nextUpdateTime.set({ hour: tomorrowTime.hour, minute: tomorrowTime.minute, second: 0 });
    }
  }

  return [nextUpdateTime, disabledDayIndex];
};


export const todayDate = () => { // Fixed
  const today = moment(new Date()).tz("America/Toronto");

  return [today, today.day()];
};

export const tomorrowDate = () => { // Fixed
  const tomorrow = moment(new Date()).tz("America/Toronto").add(1, "days");

  return [tomorrow, tomorrow.day()];
};

export const dayString = (date = moment(new Date())) => {
  // If not a moment object, convert to moment object
  if (!date.day) {
    date = moment(date);
  }

  return `${date.date()}/${date.month() + 1}/${date.year()}`;
}


/**
 * Return a clone of dateMoment with the update time for its day of week set.
 * Useful for checking "has the update time for this specific date already passed?"
 */
export const withUpdateTime = (dateMoment, settings) => {
  const clone = dateMoment.clone();
  const updateTime = getUpdateTimeForDay(clone, settings?.crons);
  if (updateTime) clone.set({ hour: updateTime.hour, minute: updateTime.minute, second: 0 });
  return clone;
};

export const isBeforeUpdateTime = (date, settings) => { // Fixed
  const todayUpdatetime = moment(date).tz("America/Toronto");
  const updateTime = getUpdateTimeForDay(todayUpdatetime, settings?.crons);

  if (!updateTime) return true; // no cron for today = treat as before update time

  todayUpdatetime.set({ hour: updateTime.hour, minute: updateTime.minute });

  return date < todayUpdatetime;
}

export const reconstructDate = (date) => {
  // Given a string in the format "d/m/yyyy", return a moment date object in toronto time zone
  const dateArr = date.split("/");
  const momentDate = moment().tz("America/Toronto");
  momentDate.set({ date: dateArr[0], month: dateArr[1] - 1, year: dateArr[2] });

  return momentDate;
}

export const isWithin5Days = (date) => {
  var today = new Date();
  var in5days = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 5
  );
  if (date <= in5days) return true;
  else return false;
}

export const isWithinAWeek = (date) => { // fixed

  const in7days = moment().tz("America/Toronto").add(7, "days");

  if (date <= in7days) return true;
  else return false;
}


export const getAppDayIndex = (date) => { // Fixed

  let dayIndex;
  // check if date is a moment object
  if (date.day) {
    dayIndex = date.day() - 1;
  } else {
    dayIndex = date.getDay() - 1;
  }

  if (dayIndex < 0) {
    dayIndex = 6;
  }

  return dayIndex;
}

export const isTodayAndAfterUpdateTime = (date, settings) => { // Fixed

  if (!date.day) date = moment(date);

  const today = new Date();

  if (date.day() != today.getDay()) {
    return false;
  }

  if (isBeforeUpdateTime(date, settings)) {
    return false;
  }

  return true;
}

export const isToday = (date) => { // Fixed
  console.log("Date: ", date);
  return moment().tz("America/Toronto").isSame(date, "day");
}

export const isNowPastUpdateTime = (settings) => !isBeforeUpdateTime(new Date(), settings) // Fixed

export const isTomorrow = (date) => { // Fixed
  // Check if the date is tomorrow
  // make use of the isToday function

  const tomorrow = moment().tz("America/Toronto").add(1, "days");

  return tomorrow.isSame(date, "day");
}

export const isAfterNDays = (date, n) => {
  const nDaysFromNow = moment().tz("America/Toronto").add(n, "days");
  return moment(date).isAfter(nDaysFromNow, "day");
}

export const isDayPast = (date) => {
  // Check if the date is in the past
  return moment(date).tz("America/Toronto").isBefore(moment().tz("America/Toronto"), "day");
}

export const isNDaysFromNow = (date, n) => { // Fixed
  const today = new Date();
  const nDaysFromNow = new Date();
  nDaysFromNow.setDate(today.getDate() + n);

  if (date.getUTCDate() != nDaysFromNow.getUTCDate() || date.getUTCMonth() != nDaysFromNow.getUTCMonth()) {
    return false;
  }

  return true;
}
