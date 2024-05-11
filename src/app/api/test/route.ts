export async function GET() {
    console.log('test GET received')
    return Response.json({ message: 'Hello World!' });
  }

  // forces the route handler to be dynamic
export const dynamic = "force-dynamic";