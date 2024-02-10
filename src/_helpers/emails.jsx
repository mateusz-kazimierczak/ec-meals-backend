import WelcomeEmail from "../../emails/WelcomeEmail";
import DailyEmail from "../../emails/DailyEmail";
import { Resend } from "resend";

const resend = new Resend("re_F7D9BAbn_5MTPGGjVNWwY96Y56K4S1ENN");


export const sendWelcomeEmail = async (user, pass) => {
    console.log("Sending welcome email to", user.email);
    await resend.emails.send({
      from: 'Acme <onboarding@resend.dev>',
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
    console.log("Sending meal emails to ", users.length, " users");
    if (users.length === 0) return;
    await resend.batch.send(
      users.map((user) => ({
        from: 'Acme <onboarding@resend.dev>',
        to: [user.email],
        subject: user.warning ? "!! No meals for tomorrow !!" : "Meal update",
        react: <DailyEmail name={user.name} noMealsWarning={user.warning} todayMeals={user.todayMeals} tomorrowMeals={user.tomorrowMeals} />,
      }))
    ).then((res) => {
      console.log("Email sent successfully", res.data.data);
    }).catch((err) => {
      console.log("Error sending email:", err);
    });
}