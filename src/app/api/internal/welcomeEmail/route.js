// import { Resend } from "resend";

// const resend = new Resend("re_F7D9BAbn_5MTPGGjVNWwY96Y56K4S1ENN");

// export async function GET() {
//   resend.emails
//     .send({
//       from: "onboarding@resend.dev",
//       to: "mateusz.alicante@gmail.com",
//       subject: "Hello World",
//       html: "<p>Congrats on sending your <strong>first email</strong>!</p>",
//     })
//     .then((res) => {
//       console.log(res);
//     });
//   return Response.json({ message: "Hello World!" });
// }

import { sendWelcomeEmail } from "@/_helpers/emails";

export async function GET() {
  sendWelcomeEmail(
    {
      email: "mateusz.alicante@gmail.com",
      firstName: "Test",
      username: "test",
    },
    "test"
  );
  return Response.json({ message: "Hello World!" });
}

// forces the route handler to be dynamic
export const dynamic = "force-dynamic";
