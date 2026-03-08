export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body;

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password required' });
  }

  const inputPw = password.trim();

  // Format: label:password:role,label:password:role
  const entries = (process.env.AUTH_PASSWORDS || '').split(',').map(e => e.trim()).filter(Boolean);

  for (const entry of entries) {
    const parts = entry.split(':').map(p => p.trim());
    if (parts.length === 3) {
      const [label, pass, role] = parts;
      if (pass === inputPw) {
        return res.status(200).json({ token: process.env.SESSION_SECRET, role, label });
      }
    } else if (entry.trim() === inputPw) {
      return res.status(200).json({ token: process.env.SESSION_SECRET, role: 'guest', label: 'unknown' });
    }
  }

  return res.status(401).json({ error: 'Wrong password' });
}
