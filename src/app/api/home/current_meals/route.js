import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";
import Day from "@/_helpers/db/models/Day";
import moment from "moment-timezone"

const HOUROFFSET =  -4;

export const revalidate = 0;

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

    
    const currentTime = new Date();
    // Convert to Toronto time
    const timeToronto = moment(currentTime).tz("America/Toronto");

    // Get the hour in Toronto time
    let currHour = timeToronto.hour();



    // Before the update time, need to handle the request differently by collecting all the breakfast from db
    if (isBeforeUpdateTime(currentTime)) {
        // send breakfast from all users
        const [dateToday, todayIndex] = todayDate();
        const breakfast = await getAllUsersBreakfast(todayIndex)

        return Response.json({ meal: "Breakfast", meals: breakfast }); 
    }

    

    // Get todays meals
    
    const [dateToday, todayIndex] = todayDate();
    console.log("Today index: ", dayString(dateToday));
    const todayObject = await Day.findOne({ date: dayString(dateToday) }, "meals");

    if (!todayObject) {
        return Response.json({ message: "No meals found for today" }, { status: 404 }); 
    }

    const meals = todayObject.meals;

    
    if (currHour < 9) {
        // send breakfast
        return Response.json({ meal: "Breakfast", meals: meals[0], currHour });

    } else if (currHour < 14) {
        // send lunch

        return Response.json({ meal: "Lunch", meals: meals[1], currHour });

   // } else if (currHour < 19) {
    } else  {
        // send dinner

        return Response.json({ meal: "Supper", meals: meals[2], currHour, currDate: new Date() });

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

const addGuests = (meal, guests, meals) => {
    guests.forEach(guest => {
        if (guest.meal === meal) {
            meals.push({name: guest.name, diet: guest.diet});
        }
    });

    return meal;
}