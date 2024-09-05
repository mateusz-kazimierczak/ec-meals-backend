const TIMEZONE_CONSTANT = -4;

export const getNextUpdateTime = () => {
  const nextUpdateTime = new Date();
  let disabledDayIndex;


  nextUpdateTime.setUTCHours(
    parseInt(process.env.UPDATE_TIME.slice(0, 2)) - TIMEZONE_CONSTANT
  );

  nextUpdateTime.setUTCMinutes(process.env.UPDATE_TIME.slice(2));
  nextUpdateTime.setUTCSeconds(0);
  nextUpdateTime.setUTCMilliseconds(0);

  const now = new Date();

  if (isBeforeUpdateTime(now) || now.getUTCHours() + TIMEZONE_CONSTANT < 0) {
    disabledDayIndex = nextUpdateTime.getUTCDay() - 1;
  } else {
    disabledDayIndex = nextUpdateTime.getUTCDay();
    nextUpdateTime.setDate(nextUpdateTime.getDate() + 1);
  }

  // convert to monday indexed:
  disabledDayIndex = disabledDayIndex - 1;

  if (disabledDayIndex < 0) {
    disabledDayIndex = 7 + disabledDayIndex;
  }

  disabledDayIndex = disabledDayIndex % 7;


  return [nextUpdateTime, disabledDayIndex];
};


export const todayDate = () => {
  const today = new Date();
  const newHour = today.getHours() + TIMEZONE_CONSTANT;

  if (newHour < 0) {
    today.setDate(today.getDate() - 1);
  } else {
    today.setHours(newHour);
  }

  let dayIndex = (today.getDay() - 1) % 7;

  if (dayIndex < 0) {
    dayIndex = 6;
  }

  return [today, dayIndex];
};

export const tomorrowDate = () => {
  const [tomorrow, tomorrowIndex] = todayDate();

  tomorrow.setDate(tomorrow.getDate() + 1);
  let dayIndex = (tomorrowIndex + 1) % 7;

  return [tomorrow, dayIndex];
};

export const dayString = (date = new Date()) =>
  `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;


export const isBeforeUpdateTime = (date) => {
  const todayUpdatetime = new Date();

  todayUpdatetime.setUTCHours(
    parseInt(process.env.UPDATE_TIME.slice(0, 2)) - TIMEZONE_CONSTANT
  );

  todayUpdatetime.setUTCMinutes(process.env.UPDATE_TIME.slice(2));


  if (
    todayUpdatetime.getTime() > date.getTime() &&
    date.getUTCHours() > 4
  ) {
    return true;
  } else {
    return false;
  }

}

export const reconstructDate = (date) => {
  var parts = date.split("/");
  var dt = new Date(
    parseInt(parts[2], 10),
    parseInt(parts[1], 10) - 1,
    parseInt(parts[0], 10)
  );
  return dt;
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

export const isWithinAWeek = (date) => {
  var today = new Date();
  var in7days = new Date(
    today.getFullYear(),
    today.getMonth(),
    // today.getDate() + (isBeforeUpdateTime(today) ? 7 : 8),
    today.getDate() + 7
  );
  if (date <= in7days) return true;
  else return false;
}

export const hasDayUpdated = (date) => {
  // modify hours and minutes to match the current time
  const now = new Date();
  const update = new Date(date);
  update.setUTCHours(
    now.getUTCHours(),
    now.getUTCMinutes(),
  );


  if (today.getTime() > update.getTime()) {
    return true;
  } else {
    return false;
  }
}

export const getAppDayIndex = (date) => {
  let dayIndex = date.getDay() - 1;

  if (dayIndex < 0) {
    dayIndex = 6;
  }

  return dayIndex;
}

export const isTodayAndAfterUpdateTime = (date) => {
  const today = new Date();

  if (date.getDay() != today.getDay()) {
    return false;
  }

  if (isBeforeUpdateTime(date)) {
    return false;
  }

  return true;
}

export const isToday = (date) => {
  const today = new Date();

  if (date.getDay() != today.getDay()) {
    return false;
  }

  return true;
}

export const isNowPastUpdateTime = () => {
  const now = new Date();

  if (isBeforeUpdateTime(now)) {
    return false;
  }

  return true;
}

export const isTomorrow = (date) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getDay() != tomorrow.getDay()) {
    return false;
  }

  return true;
}