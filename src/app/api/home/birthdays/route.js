import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";
import moment from "moment-timezone"


import {
    todayDate,
    tomorrowDate,
    isBeforeUpdateTime,
    dayString,
    getNextUpdateTime,
  } from "@/_helpers/time";
import { act } from "react";

export async function GET(req, res) { 
    await connectDB();

    // Get all users who have a birthday within 30 days
    const acceptableMonths = [moment().month(), moment().add(1, "months").month()];
    
    const birthdayUsers = await User.find({ active: true, birthdayMonth: { $in: acceptableMonths } }, "firstName lastName birthdayMonth birthdayDay");

    let birthdayDisplay = birthdayUsers.map((user) => {
        // make sure birthday is in the future
        const birthdayDate = moment().tz("America/Toronto").month(user.birthdayMonth - 1).date(user.birthdayDay)
        
        return {
            name: user.firstName + " " + user.lastName,
            days: birthdayDate.diff(moment().tz("America/Toronto").startOf("day"), "days"),
            id: user._id
        }
    })

    // one more filter to make sure birthday is not negative
    birthdayDisplay = birthdayDisplay.filter((user) => user.days >= 0);

    return Response.json({ birthdayDisplay });

}
