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
  const raw = process.env.AUTH_PASSWORDS || '';
  const entries = raw.split(',').map(e => e.trim()).filter(Boolean);

  const debugEntries = entries.map(e => {
    const parts = e.split(':').map(p => p.trim());
    return { parts: parts.length, label: parts[0], passLen: parts[1] ? parts[1].length : 0, passChars: parts[1] ? JSON.stringify(parts[1]) : 'none' };
  });

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

  return res.status(401).json({
    error: 'Wrong password',
    debug: { inputLen: inputPw.length, inputChars: JSON.stringify(inputPw), entryCount: entries.length, entries: debugEntries }
  });
}
