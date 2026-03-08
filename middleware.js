export default function middleware(request) {
  const url = new URL(request.url);

  // Public routes - no auth needed
  if (
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/api/login' ||
    url.pathname.startsWith('/avatars/')
  ) {
    return;
  }

  // All other routes (API calls) require session token
  const token = request.headers.get('x-session-token');
  const validToken = process.env.SESSION_SECRET;

  if (!token || token !== validToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const config = {
  matcher: ['/((?!manifest.json).*)'],
};
