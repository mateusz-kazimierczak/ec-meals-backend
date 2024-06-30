import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";
import Day from "@/_helpers/db/models/Day";

const HOUROFFSET =  -4;

import {
    todayDate,
    tomorrowDate,
    isBeforeUpdateTime,
    dayString,
    getNextUpdateTime,
  } from "@/_helpers/time";

import { checkUsersMeals } from "../../day/route"

export async function GET(req, res) { 
    await connectDB();

    // Decide which meals to send
    const currentTime = new Date();
    const currHour = currentTime.getUTCHours() + HOUROFFSET;

    // Before the update time, need to handle the request differently by collecting all the breakfast from db
    if (isBeforeUpdateTime(currentTime)) {
        // send breakfast from all users
        const [dateToday, todayIndex] = todayDate();
        const breakfast = await getAllUsersBreakfast(todayIndex)

        return Response.json({ meal: "Breakfast", meals: breakfast }); 
    }

    

    // Get todays meals
    
    const [dateToday, todayIndex] = todayDate();
    const meals = (await Day.findOne({ date: dayString(dateToday) }, "meals")).meals;
    
    
    
    if (currHour < 9) {
        // send breakfast
        return Response.json({ meal: "Breakfast", meals: meals[0] });

    } else if (currHour < 14) {
        // send lunch

        return Response.json({ meal: "Lunch", meals: meals[1] });

   // } else if (currHour < 19) {
    } else  {
        // send dinner

        return Response.json({ meal: "Supper", meals: meals[2] });

    }

}


const getAllUsersBreakfast = async (dayIndex) => {
    // Get all users breakfast
    const allUsers = await User.find({active: true});

    let breakfast = [];

    allUsers.forEach(user => {
        if (user.meals[dayIndex][0]) {
            breakfast.push({name: `${user.firstName} ${user.lastName}`, id: user._id, diet: user.diet});
        }
    });

    return breakfast;
}