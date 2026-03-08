export default function middleware(request) {
  if (request.url.includes('manifest.json')) {
    return;
  }

  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return new Response('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="BMAD Voice"' },
    });
  }

  const base64 = authHeader.split(' ')[1];
  const decoded = atob(base64);
  const password = decoded.split(':').slice(1).join(':');

  const validPasswords = (process.env.AUTH_PASSWORDS || '').split(',').map(p => p.trim()).filter(Boolean);

  if (validPasswords.length === 0) {
    return new Response('Server misconfigured: no passwords set', { status: 500 });
  }

  if (!validPasswords.includes(password)) {
    return new Response('Invalid credentials', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="BMAD Voice"' },
    });
  }
}

export const config = {
  matcher: ['/((?!manifest.json).*)'],
};
