// Check if there are any user in the database, otherwise create the admin user

export async function register() {
  //create admin user if none exists
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./_helpers/db/initAdmin");
  }
}

// forces the route handler to be dynamic
export const dynamic = "force-dynamic";
