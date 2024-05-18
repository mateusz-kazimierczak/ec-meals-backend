const TIMEZONE_CONSTANT = -4;

export const getNextUpdateTime = () => {
  const nextUpdateTime = new Date();
  let disabledDayIndex;

  nextUpdateTime.setUTCHours(
    process.env.UPDATE_TIME.slice(0, 2) - TIMEZONE_CONSTANT
  );
  nextUpdateTime.setUTCMinutes(process.env.UPDATE_TIME.slice(2));
  nextUpdateTime.setUTCSeconds(0);
  nextUpdateTime.setUTCMilliseconds(0);

  const now = new Date();
  if (nextUpdateTime < now) {
    nextUpdateTime.setDate(nextUpdateTime.getDate() + 1);
    disabledDayIndex = now.getDay() - 1;
  } else {
    disabledDayIndex = now.getDay() - 2;
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

  return [today, dayIndex];
};

export const tomorrowDate = () => {
  const [tomorrow, tomorrowIndex] = todayDate();

  tomorrow.setDate(tomorrow.getDate() + 1);
  let dayIndex = (tomorrowIndex + 1) % 7;

  return [tomorrow, dayIndex];
};

export const dayString = (date) =>
  `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
