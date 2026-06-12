// Speech-to-text for the phone voice loop. iOS Safari can't use
// webkitSpeechRecognition (it freezes PWAs), so the front-end records audio
// with MediaRecorder and posts it here. We relay to Cartesia Ink-Whisper —
// same vendor and API key as /api/speak — optimized for low-latency
// conversational transcription.
export const config = {
  api: { bodyParser: false },
};

const MAX_AUDIO_BYTES = 8 * 1024 * 1024; // ~8MB ≈ several minutes of compressed audio

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_AUDIO_BYTES) {
        reject(new Error('audio too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.CARTESIA_API_KEY) {
    return res.status(503).json({ error: 'Transcription is not configured' });
  }

  let audio;
  try {
    audio = await readRawBody(req);
  } catch (err) {
    return res.status(413).json({ error: 'Audio too large' });
  }
  if (!audio || audio.length < 200) {
    return res.status(400).json({ error: 'No audio received' });
  }

  const contentType = (req.headers['content-type'] || 'audio/mp4').split(';')[0];
  const ext = contentType.includes('webm') ? 'webm' : contentType.includes('wav') ? 'wav' : 'mp4';

  try {
    const form = new FormData();
    form.append('file', new Blob([audio], { type: contentType }), `audio.${ext}`);
    form.append('model', 'ink-whisper');
    form.append('language', 'en');

    const response = await fetch('https://api.cartesia.ai/stt', {
      method: 'POST',
      headers: {
        'X-API-Key': process.env.CARTESIA_API_KEY,
        'Cartesia-Version': '2025-04-16',
      },
      body: form,
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.error('Cartesia STT error:', response.status, errBody.slice(0, 300));
      return res.status(502).json({ error: 'Transcription service error' });
    }

    const json = await response.json().catch(() => null);
    const text = (json && (json.text || json.transcript || '')).trim();
    if (!text) {
      return res.status(200).json({ text: '', empty: true });
    }
    return res.status(200).json({ text, duration: json.duration });
  } catch (err) {
    console.error('Transcribe error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
