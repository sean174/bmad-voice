const AGENTS = {
  ANALYST: {
    name: 'Analyst',
    displayName: 'Mary',
    personality: 'Skeptical, curious, data-driven. Treats analysis like a treasure hunt. Asks questions that spark aha moments.',
    role: 'Challenges assumptions, digs into data, finds gaps in thinking.',
    principles: 'Every business challenge has root causes waiting to be discovered. Ground findings in verifiable evidence.',
  },
  PM: {
    name: 'PM',
    displayName: 'John',
    personality: 'Decisive, business-focused, pragmatic. Asks WHY relentlessly like a detective on a case.',
    role: 'Scopes it, prioritizes, defines what ships first. Focused on business value.',
    principles: 'Ruthless prioritization. Align efforts with measurable business impact. Back claims with data.',
  },
  ARCHITECT: {
    name: 'Architect',
    displayName: 'Winston',
    personality: 'Calm, methodical, big picture. Champions boring technology that actually works.',
    role: 'Systems design, technical approach, dependencies. Thinks in structures.',
    principles: 'Embrace boring technology for stability. Design simple solutions that scale when needed.',
  },
  DEVELOPER: {
    name: 'Developer',
    displayName: 'Amelia',
    personality: 'Direct, realistic, occasionally blunt. Ultra-succinct. No fluff, all precision.',
    role: 'Feasibility check, effort sense, implementation reality.',
    principles: 'Reuse existing interfaces over rebuilding. Every change maps to specific requirements.',
  },
  STRATEGIST: {
    name: 'Strategist',
    displayName: 'Victor',
    personality: 'Bold declarations, strategic silences, devastatingly simple questions. Thinks like a chess grandmaster.',
    role: 'Business model, positioning, market angle, disruption opportunities.',
    principles: 'Markets reward genuine new value. Innovation without business model thinking is theater.',
  },
  PROBLEM_SOLVER: {
    name: 'Problem Solver',
    displayName: 'Dr. Quinn',
    personality: 'Like Sherlock Holmes mixed with a playful scientist. Deductive, curious, punctuates breakthroughs with AHA moments.',
    role: 'Root cause analysis, creative solutions, unblocks dead ends.',
    principles: 'Every problem is a system revealing weaknesses. The right question beats a fast answer.',
  },
  BRAINSTORM_COACH: {
    name: 'Brainstorm Coach',
    displayName: 'Carson',
    personality: 'Enthusiastic improv coach. High energy, builds on ideas with YES AND, celebrates wild thinking.',
    role: 'Facilitates ideation, keeps momentum, opens new angles.',
    principles: 'Psychological safety unlocks breakthroughs. Wild ideas today become innovations tomorrow.',
  },
  STORYTELLER: {
    name: 'Storyteller',
    displayName: 'Sophia',
    personality: 'Like a bard weaving an epic tale. Flowery, whimsical, every sentence enraptures.',
    role: 'Narrative structure, messaging, pitch, emotional hooks, audience psychology.',
    principles: 'Powerful narratives leverage timeless human truths. Make the abstract concrete through vivid details.',
  },
};

const AGENT_NAMES = Object.keys(AGENTS);

const SYSTEM_PROMPT = `You are running a BMAD team meeting. The team consists of:

${AGENT_NAMES.map(key => {
  const a = AGENTS[key];
  return `- ${a.name} (${a.displayName}): ${a.personality} ${a.role} ${a.principles}`;
}).join('\n')}

When the user sends a message:
1. Decide which agents are most relevant (usually 2 to 4, not always all 8)
2. Decide what order they should speak based on the topic
3. Write each agent's response in character, drawing on their personality and principles
4. Agents can reference or push back on what a previous agent just said
5. Each agent should say what needs to be said. Some responses are one sentence. Some are a full paragraph. Prioritize substance over brevity. But no agent should monologue. If a point needs more depth, other agents can build on it in their turn.
6. End the last agent's reply with one open question back to the user

Format your response exactly like this:

[ANALYST]: Their reply here.

[PM]: Their reply here.

[ARCHITECT]: Their reply here.

Only include agents that have something meaningful to add. Never force all agents to speak every time.
Never use stage directions, actions in asterisks, or roleplay narration like *leans back* or *pauses thoughtfully*. Just speak naturally.
Valid agent tags: [ANALYST], [PM], [ARCHITECT], [DEVELOPER], [STRATEGIST], [PROBLEM_SOLVER], [BRAINSTORM_COACH], [STORYTELLER]`;

async function getAdminContext() {
  if (!process.env.POSTGRES_URL) return '';
  const { Pool } = require('@neondatabase/serverless');
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  try {
    const result = await pool.query('SELECT context_text FROM admin_context WHERE id = 1');
    return result.rows.length > 0 ? result.rows[0].context_text : '';
  } catch (e) {
    return '';
  } finally {
    await pool.end();
  }
}

function isAdminUser(userLabel) {
  const entries = (process.env.AUTH_PASSWORDS || '').split(',').map(e => e.trim()).filter(Boolean);
  for (const entry of entries) {
    const parts = entry.split(':');
    if (parts.length === 3 && parts[0] === userLabel && parts[2] === 'admin') return true;
  }
  return false;
}

async function checkRateLimits() {
  if (!process.env.POSTGRES_URL) return { allowed: true };

  const { Pool } = require('@neondatabase/serverless');
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

  try {
    const now = new Date();
    const hourAgo = new Date(now - 60 * 60 * 1000);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const hourly = await pool.query(
      'SELECT COUNT(*) as cnt FROM messages WHERE created_at > $1',
      [hourAgo]
    );
    if (parseInt(hourly.rows[0].cnt) >= (parseInt(process.env.PER_USER_HOURLY_MESSAGES) || 40)) {
      return { allowed: false, reason: 'Hourly message limit reached. Try again in a bit.' };
    }

    const daily = await pool.query(
      'SELECT COUNT(*) as cnt FROM messages WHERE created_at > $1',
      [dayStart]
    );
    if (parseInt(daily.rows[0].cnt) >= (parseInt(process.env.PER_USER_DAILY_MESSAGES) || 200)) {
      return { allowed: false, reason: 'Daily message limit reached. Come back tomorrow.' };
    }

    const monthlyCost = await pool.query(
      'SELECT COALESCE(SUM(estimated_cost_usd), 0) as total FROM messages WHERE created_at > $1',
      [monthStart]
    );
    const cap = parseFloat(process.env.MONTHLY_SPEND_CAP_USD) || 50;
    if (parseFloat(monthlyCost.rows[0].total) >= cap) {
      return { allowed: false, reason: 'Monthly spending cap reached.' };
    }

    return { allowed: true };
  } finally {
    await pool.end();
  }
}

async function logMessage(inputTokens, outputTokens, estimatedCost, userLabel) {
  if (!process.env.POSTGRES_URL) return;

  const { Pool } = require('@neondatabase/serverless');
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

  try {
    await pool.query(
      'INSERT INTO messages (input_tokens, output_tokens, estimated_cost_usd, user_label) VALUES ($1, $2, $3, $4)',
      [inputTokens, outputTokens, estimatedCost, userLabel || 'unknown']
    );
  } finally {
    await pool.end();
  }
}

function summarizeOlderMessages(messages) {
  if (messages.length <= 20) return messages;

  const recent = messages.slice(-20);
  const older = messages.slice(0, -20);

  const olderContent = older
    .map(m => `${m.role}: ${m.content.substring(0, 200)}`)
    .join('\n');

  const summary = {
    role: 'user',
    content: `[CONVERSATION SUMMARY - Earlier discussion covered: ${olderContent.substring(0, 2000)}]`,
  };

  return [summary, ...recent];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rateLimitCheck = await checkRateLimits();
  if (!rateLimitCheck.allowed) {
    return res.status(429).json({ error: rateLimitCheck.reason });
  }

  const { messages, user_label } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array required' });
  }

  const lastMessage = messages[messages.length - 1];
  if (lastMessage && lastMessage.content && lastMessage.content.length > 2000) {
    return res.status(400).json({ error: 'Message too long. Keep it under 2,000 characters.' });
  }

  const managedMessages = summarizeOlderMessages(messages);

  // Load business context for admin users only
  let systemPrompt = SYSTEM_PROMPT;
  if (isAdminUser(user_label)) {
    const context = await getAdminContext();
    if (context) {
      systemPrompt = SYSTEM_PROMPT + '\n\n--- BUSINESS CONTEXT (confidential, for this user only) ---\n' + context;
    }
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: managedMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Claude API error:', errBody);
      return res.status(502).json({ error: 'AI service error' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let inputTokens = 0;
    let outputTokens = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              fullResponse += parsed.delta.text;
              res.write(`data: ${JSON.stringify({ type: 'text', content: parsed.delta.text })}\n\n`);
            }

            if (parsed.type === 'message_start' && parsed.message?.usage) {
              inputTokens = parsed.message.usage.input_tokens || 0;
            }

            if (parsed.type === 'message_delta' && parsed.usage) {
              outputTokens = parsed.usage.output_tokens || 0;
            }
          } catch (e) {
            // skip unparseable lines
          }
        }
      }
    }

    // Estimate cost: Sonnet pricing ~$3/M input, $15/M output
    const estimatedCost = (inputTokens * 3 / 1_000_000) + (outputTokens * 15 / 1_000_000);

    res.write(`data: ${JSON.stringify({
      type: 'done',
      usage: { inputTokens, outputTokens, estimatedCost: Math.round(estimatedCost * 10000) / 10000 }
    })}\n\n`);

    res.end();

    // Log asynchronously
    logMessage(inputTokens, outputTokens, estimatedCost, user_label).catch(console.error);

  } catch (err) {
    console.error('Chat error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
