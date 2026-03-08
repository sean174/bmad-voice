export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body;

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password required' });
  }

  const validPasswords = (process.env.AUTH_PASSWORDS || '').split(',').map(p => p.trim()).filter(Boolean);

  if (validPasswords.includes(password)) {
    return res.status(200).json({ token: process.env.SESSION_SECRET });
  }

  return res.status(401).json({ error: 'Wrong password' });
}
