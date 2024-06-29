const TIMEZONE_CONSTANT = -4;

export const getNextUpdateTime = () => {
  const nextUpdateTime = new Date();
  let disabledDayIndex;


  if (isBeforeUpdateTime(nextUpdateTime)) {
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
  todayUpdatetime.setUTCSeconds(0);
  todayUpdatetime.setUTCMilliseconds(0);

  if (
    todayUpdatetime.getTime() > date.getTime() ||
    date.getUTCHours() < 4
  ) {
    return true;
  } else {
    return false;
  }

}