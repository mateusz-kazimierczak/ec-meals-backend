import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";
import Day from "@/_helpers/db/models/Day";
import mongoose from "mongoose";
import { isTodayAndAfterUpdateTime, isBeforeUpdateTime, dayString, isWithinAWeek, getAppDayIndex } from "@/_helpers/time";
import { parse } from "path";
import { reconstructDate } from "@/_helpers/time";
import moment from "moment-timezone";

export async function POST(req, res) {
  const [body] = await Promise.all([req.json(), connectDB()]);

  // For now, this will only support normal meals (non packed meals)
  const day = reconstructDate(body.date);
  
  // set the time for the day to the current time
  const today = moment().tz("America/Toronto");
  day.set({ hour: today.hour(), minute: today.minute() });

  const dayObject = await Day.findOne({ date: dayString(day) });
  
  if (body.userID.startsWith("_GUEST_")) {

      const guestName = body.userID.split("_GUEST_")[1];
      const guestIndex = dayObject.guests.findIndex((guest) => guest.name == guestName);

      if (guestIndex != -1) {
        dayObject.guests.splice(guestIndex, 1);
      }

      await Day.findByIdAndUpdate(dayObject._id, { guests: dayObject.guests });
      
    } else {


      if (dayObject && dayObject.meals) {
        const meals = dayObject.meals;
        const userIndex = meals[body.mealID].findIndex((user) => user._id == body.userID);

        if (userIndex != -1) {
          meals[body.mealID].splice(userIndex, 1);
        }

        await Day.findByIdAndUpdate(dayObject._id, { meals: meals });
      }

      if (!isTodayAndAfterUpdateTime(day)) {

        // Must also update the meal matrix for the user
        
        const user = await User.findById(body.userID);

        if (user) {

          user.meals[getAppDayIndex(day)][body.mealID] = false;

          await User.findByIdAndUpdate(body.userID, { meals: user.meals });
        }
        
      } 
    }
  
  

  return Response.json({ success: true });
  
}
