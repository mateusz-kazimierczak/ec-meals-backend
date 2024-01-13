export async function GET() {
    console.log('test GET received')
    return Response.json({ message: 'Hello World!' });
  }