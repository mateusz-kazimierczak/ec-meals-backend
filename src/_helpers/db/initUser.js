const MealTypes = ["B", "L", "S", "P1", "P2", "PS", "X"];
const DaysOfTheWeek = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default function InitUser(User) {
  const meals = DaysOfTheWeek.map(() => MealTypes.map(() => false));
  User.preferences = {
    email: 1,
  };
  User.meals = meals;
}
