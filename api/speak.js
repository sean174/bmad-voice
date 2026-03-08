const VOICE_MAP = {
  ANALYST: process.env.CARTESIA_VOICE_ID_ANALYST,
  PM: process.env.CARTESIA_VOICE_ID_PM,
  ARCHITECT: process.env.CARTESIA_VOICE_ID_ARCHITECT,
  DEVELOPER: process.env.CARTESIA_VOICE_ID_DEVELOPER,
  STRATEGIST: process.env.CARTESIA_VOICE_ID_STRATEGIST,
  PROBLEM_SOLVER: process.env.CARTESIA_VOICE_ID_PROBLEM_SOLVER,
  BRAINSTORM_COACH: process.env.CARTESIA_VOICE_ID_BRAINSTORM_COACH,
  STORYTELLER: process.env.CARTESIA_VOICE_ID_STORYTELLER,
};

// Default voice if agent-specific one isn't set
const DEFAULT_VOICE = 'a0e99841-438c-4a64-b679-ae501e7d6091';

function cleanTextForSpeech(text) {
  return text
    .replace(/\*[^*]+\*/g, '')      // *stage directions* and *italics*
    .replace(/```[\s\S]*?```/g, '') // code blocks
    .replace(/`[^`]+`/g, '')        // inline code
    .replace(/https?:\/\/\S+/g, '') // URLs
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // markdown links -> text
    .replace(/[_#>\-|]/g, '')       // markdown formatting
    .replace(/\n{2,}/g, '. ')       // double newlines to pause
    .replace(/\n/g, ' ')            // single newlines to space
    .replace(/\s{2,}/g, ' ')        // collapse whitespace
    .trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, agent } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required' });
  }

  const cleanText = cleanTextForSpeech(text);
  if (!cleanText) {
    return res.status(400).json({ error: 'No speakable text after cleaning' });
  }

  const voiceId = VOICE_MAP[agent] || DEFAULT_VOICE;

  try {
    const response = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.CARTESIA_API_KEY,
        'Cartesia-Version': '2024-06-10',
      },
      body: JSON.stringify({
        model_id: 'sonic-2',
        transcript: cleanText,
        voice: { mode: 'id', id: voiceId },
        language: 'en',
        speed: 'fast',
        output_format: {
          container: 'mp3',
          bit_rate: 128000,
          sample_rate: 44100,
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Cartesia error:', errBody);
      return res.status(502).json({ error: 'Voice service error' });
    }

    const audioBuffer = await response.arrayBuffer();
    const charCount = cleanText.length;

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('X-Cartesia-Characters', charCount.toString());
    res.send(Buffer.from(audioBuffer));

  } catch (err) {
    console.error('Speak error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
