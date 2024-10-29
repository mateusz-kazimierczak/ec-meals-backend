import WelcomeEmail from "../../emails/WelcomeEmail";
import DailyEmail from "../../emails/DailyEmail";
import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY

const resend = new Resend(resendApiKey);


export const sendWelcomeEmail = async (user, pass) => {
    console.log("Sending welcome email to", user.email);
    await resend.emails.send({
      from: 'Meals <meals@mateusz.us>',
      to: [user.email],
      subject: `Welcome to EC, ${user.firstName}!`,
      react: <WelcomeEmail name={user.firstName} username={user.username} pass={pass} />,
    }).then((res) => {
      console.log("Email sent successfully", res);
    }).catch((err) => {
      console.log("Error sending email:", err);
    });
  };
  
export const sendMealEmails = async (users) => {
    if (process.env.ENABLE_EMAIL != "true") return console.log("Skipping email sending");

    console.log("Sending meal emails to ", users.length, " users");
    if (users.length === 0) return;


    try {
      resend.batch.send(
        users.map((user) => ({
          from: 'Meals <meals@mateusz.us>',
          to: [user.email],
          subject: user.warning ? "!! No meals for tomorrow !!" : "Meal update",
          react: <DailyEmail name={user.name} noMealsWarning={user.warning} todayMeals={user.todayMeals} tomorrowMeals={user.tomorrowMeals} />,
        }))
      )
    } catch (err) {
      console.log("Error sending email:", err
      );
    }
}