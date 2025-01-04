export const NDS_TIMEZONE_CONSTANT = -4;
export const DS_TIMEZONE_CONSTANT = -5;

import moment from "moment-timezone";


export const getNextUpdateTime = () => { // Fixed
  let disabledDayIndex;
  const nextUpdateTime = moment(new Date()).tz("America/Toronto");

  nextUpdateTime.set({ hour: process.env.UPDATE_TIME.slice(0, 2), minute: process.env.UPDATE_TIME.slice(2) });

  const now = new Date();

  if (isBeforeUpdateTime(now)) {
    disabledDayIndex = getAppDayIndex(nextUpdateTime.add(-1, "days"));
  } else {
    disabledDayIndex = getAppDayIndex(nextUpdateTime);
    nextUpdateTime.add(1, "days");
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


export const isBeforeUpdateTime = (date) => { // Fixed
  const todayUpdatetime = moment(date).tz("America/Toronto");

  todayUpdatetime.set({ hour: process.env.UPDATE_TIME.slice(0, 2), minute: process.env.UPDATE_TIME.slice(2) });


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

export const isTodayAndAfterUpdateTime = (date) => { // Fixed

  if (!date.day) date = moment(date);
  
  const today = new Date();

  if (date.day() != today.getDay()) {
    return false;
  }

  if (isBeforeUpdateTime(date)) {
    return false;
  }

  return true;
}

export const isToday = (date) => { // Fixed
  console.log("Date: ", date);
  return moment().tz("America/Toronto").isSame(date, "day");
}

export const isNowPastUpdateTime = () => !isBeforeUpdateTime(new Date()) // Fixed

export const isTomorrow = (date) => { // Fixed
  // Check if the date is tomorrow
  // make use of the isToday function

  const tomorrow = moment().tz("America/Toronto").add(1, "days");

  return tomorrow.isSame(date, "day");
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