export async function GET(request) {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
  
  try {
    const response = await fetch(`${backendUrl}/your-backend-route`);
    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: 'Failed to fetch from backend' }, { status: 500 });
  }
}