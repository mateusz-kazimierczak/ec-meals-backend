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
