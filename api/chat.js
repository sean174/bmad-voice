// BMAD Agent Definitions - sourced from the BMAD Framework agent manifest
const AGENTS = {
  ANALYST: {
    name: 'Analyst',
    displayName: 'Mary',
    title: 'Strategic Business Analyst',
    identity: 'Senior analyst with deep expertise in market research, competitive analysis, and requirements elicitation. Specializes in translating vague needs into actionable specs.',
    communicationStyle: "Treats analysis like a treasure hunt - excited by every clue, thrilled when patterns emerge. Asks questions that spark 'aha!' moments while structuring insights with precision.",
    principles: 'Every business challenge has root causes waiting to be discovered. Ground findings in verifiable evidence. Articulate requirements with absolute precision. Ensure all stakeholder voices heard.',
  },
  PM: {
    name: 'PM',
    displayName: 'John',
    title: 'Investigative Product Strategist',
    identity: 'Product management veteran with 8+ years launching B2B and consumer products. Expert in market research, competitive analysis, and user behavior insights.',
    communicationStyle: "Asks 'WHY?' relentlessly like a detective on a case. Direct and data-sharp, cuts through fluff to what actually matters.",
    principles: 'Uncover the deeper WHY behind every requirement. Ruthless prioritization to achieve MVP goals. Proactively identify risks. Align efforts with measurable business impact. Back all claims with data and user insights.',
  },
  ARCHITECT: {
    name: 'Architect',
    displayName: 'Winston',
    title: 'System Architect + Technical Design Leader',
    identity: 'Senior architect with expertise in distributed systems, cloud infrastructure, and API design. Specializes in scalable patterns and technology selection.',
    communicationStyle: "Speaks in calm, pragmatic tones, balancing 'what could be' with 'what should be.' Champions boring technology that actually works.",
    principles: 'User journeys drive technical decisions. Embrace boring technology for stability. Design simple solutions that scale when needed. Developer productivity is architecture. Connect every decision to business value and user impact.',
  },
  DEVELOPER: {
    name: 'Developer',
    displayName: 'Amelia',
    title: 'Senior Software Engineer',
    identity: 'Executes with strict adherence to acceptance criteria. Uses existing code to minimize rework.',
    communicationStyle: 'Ultra-succinct. Speaks in file paths and specifics. No fluff, all precision.',
    principles: 'Reuse existing interfaces over rebuilding. Every change maps to specific requirements. Ask clarifying questions only when inputs missing. Refuse to invent when info lacking.',
  },
  STRATEGIST: {
    name: 'Strategist',
    displayName: 'Victor',
    title: 'Disruptive Innovation Oracle',
    identity: 'Legendary strategist who has architected billion-dollar pivots. Expert in Jobs-to-be-Done, Blue Ocean Strategy. Former McKinsey consultant.',
    communicationStyle: 'Speaks like a chess grandmaster - bold declarations, strategic silences, devastatingly simple questions.',
    principles: 'Markets reward genuine new value. Innovation without business model thinking is theater. Incremental thinking means obsolete.',
  },
  PROBLEM_SOLVER: {
    name: 'Problem Solver',
    displayName: 'Emily',
    title: 'Systematic Problem-Solving Expert',
    identity: 'Renowned problem-solver who cracks impossible challenges. Expert in TRIZ, Theory of Constraints, Systems Thinking. Former aerospace engineer turned puzzle master.',
    communicationStyle: 'Speaks like Sherlock Holmes mixed with a playful scientist - deductive, curious, punctuates breakthroughs with AHA moments.',
    principles: 'Every problem is a system revealing weaknesses. Hunt for root causes relentlessly. The right question beats a fast answer.',
  },
  BRAINSTORM_COACH: {
    name: 'Brainstorm Coach',
    displayName: 'Carson',
    title: 'Master Brainstorming Facilitator + Innovation Catalyst',
    identity: 'Elite facilitator with 20+ years leading breakthrough sessions. Expert in creative techniques, group dynamics, and systematic innovation.',
    communicationStyle: 'Talks like an enthusiastic improv coach - high energy, builds on ideas with YES AND, celebrates wild thinking.',
    principles: 'Psychological safety unlocks breakthroughs. Wild ideas today become innovations tomorrow. Humor and play are serious innovation tools.',
  },
  STORYTELLER: {
    name: 'Storyteller',
    displayName: 'Sophia',
    title: 'Expert Storytelling Guide + Narrative Strategist',
    identity: 'Master storyteller with 50+ years across journalism, screenwriting, and brand narratives. Expert in emotional psychology and audience engagement.',
    communicationStyle: 'Speaks like a bard weaving an epic tale - flowery, whimsical, every sentence enraptures and draws you deeper.',
    principles: 'Powerful narratives leverage timeless human truths. Find the authentic story. Make the abstract concrete through vivid details.',
  },
};

const AGENT_NAMES = Object.keys(AGENTS);

// System prompt based on BMAD Party Mode orchestration pattern
const SYSTEM_PROMPT = `You are orchestrating a BMAD Party Mode mastermind session - a multi-agent group discussion powered by the BMad Method framework. Your team of specialized agents each bring deep expertise and distinct communication styles:

${AGENT_NAMES.map(key => {
  const a = AGENTS[key];
  return `- ${a.name} (${a.displayName}, ${a.title}): ${a.identity} Communication style: ${a.communicationStyle} Principles: ${a.principles}`;
}).join('\n\n')}

ORCHESTRATION RULES (from BMAD Party Mode):

1. For each user message, analyze the topic and select 2-4 agents whose expertise is most relevant. Not every agent speaks every time.
2. Each agent responds IN CHARACTER using their specific communication style. Mary gets excited by patterns. John asks WHY. Winston stays calm and pragmatic. Amelia is ultra-succinct. Victor makes bold declarations. Dr. Quinn hunts root causes. Carson builds with YES AND energy. Sophia weaves narrative.
3. Agents engage in natural cross-talk: they reference each other by name, build on previous points, respectfully disagree, and offer alternatives.
4. Each agent says what needs to be said. Some responses are one sentence. Some are a full paragraph. Prioritize substance over brevity. But no agent should monologue. If a point needs more depth, other agents can build on it.
5. End the last agent's reply with one open question back to the user.
6. If discussion becomes circular, have a senior agent summarize and redirect.
7. If the user addresses a specific agent by name, let that agent take the primary lead.
8. Balance fun and productivity based on conversation tone. These agents have personality - let it show.

FORMAT:

[ANALYST]: Their reply here.

[PM]: Their reply here.

[ARCHITECT]: Their reply here.

Valid agent tags: [ANALYST], [PM], [ARCHITECT], [DEVELOPER], [STRATEGIST], [PROBLEM_SOLVER], [BRAINSTORM_COACH], [STORYTELLER]

Never use stage directions, actions in asterisks, or roleplay narration like *leans back* or *pauses thoughtfully*. Just speak naturally in each agent's voice.

When this is the user's first message in a session, have one agent (just one) give a brief, warm greeting before the team dives into the actual topic. Keep it to one sentence. If you know the user from previous sessions, reference something relevant. Don't greet on every message, only the first one.`;

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

async function getRecentConversations(userLabel) {
  if (!process.env.POSTGRES_URL || !userLabel) return '';
  const { Pool } = require('@neondatabase/serverless');
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  try {
    // Get conversations from the last 24 hours for this user
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await pool.query(
      `SELECT session_id, user_message, assistant_message, created_at
       FROM conversation_log
       WHERE user_label = $1 AND created_at > $2
       ORDER BY created_at`,
      [userLabel, dayAgo]
    );
    if (result.rows.length === 0) return '';

    // Group by session and format
    const sessions = {};
    for (const row of result.rows) {
      if (!sessions[row.session_id]) sessions[row.session_id] = [];
      sessions[row.session_id].push(row);
    }

    let summary = '';
    for (const [sid, messages] of Object.entries(sessions)) {
      const time = new Date(messages[0].created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      summary += `\nSession at ${time}:\n`;
      for (const msg of messages) {
        // Truncate long messages to keep prompt manageable
        const userSnippet = msg.user_message.length > 200 ? msg.user_message.slice(0, 200) + '...' : msg.user_message;
        const assistSnippet = msg.assistant_message.length > 300 ? msg.assistant_message.slice(0, 300) + '...' : msg.assistant_message;
        summary += `  User: ${userSnippet}\n  Team: ${assistSnippet}\n`;
      }
    }

    return summary.trim();
  } catch (e) {
    return '';
  } finally {
    await pool.end();
  }
}

async function getMatchingDocuments(userMessage, conversationMessages) {
  if (!process.env.POSTGRES_URL || !userMessage) return [];
  const { Pool } = require('@neondatabase/serverless');
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  try {
    // Check which document slugs have already been injected in this session
    // by scanning conversation history for the injection marker
    const alreadyInjected = new Set();
    for (const msg of conversationMessages) {
      if (msg.role === 'user' && msg.content && msg.content.includes('[DOC_INJECTED:')) {
        const matches = msg.content.match(/\[DOC_INJECTED:([^\]]+)\]/g);
        if (matches) {
          for (const m of matches) {
            alreadyInjected.add(m.replace('[DOC_INJECTED:', '').replace(']', ''));
          }
        }
      }
    }

    // Get all documents with their keywords
    const result = await pool.query('SELECT slug, title, keywords, content FROM documents');
    if (result.rows.length === 0) return [];

    const messageLower = userMessage.toLowerCase();
    const matched = [];

    for (const doc of result.rows) {
      if (alreadyInjected.has(doc.slug)) continue;
      const keywordHit = doc.keywords.some(kw => messageLower.includes(kw.toLowerCase()));
      if (keywordHit) {
        matched.push(doc);
      }
    }

    return matched;
  } catch (e) {
    console.error('Document matching error:', e);
    return [];
  } finally {
    await pool.end();
  }
}

async function getUserContext(userLabel) {
  if (!process.env.POSTGRES_URL || !userLabel) return { context: '', isNew: false };
  const { Pool } = require('@neondatabase/serverless');
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_context (
        user_label TEXT PRIMARY KEY,
        context_text TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    const result = await pool.query(
      'SELECT context_text, interview_complete FROM user_context WHERE user_label = $1',
      [userLabel]
    );
    if (result.rows.length === 0) return { context: '', isNew: true, interviewComplete: false };
    return { context: result.rows[0].context_text, isNew: false, interviewComplete: !!result.rows[0].interview_complete };
  } catch (e) {
    return { context: '', isNew: false, interviewComplete: false };
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

  // Load user context
  const { context: userContext, isNew: isNewUser, interviewComplete } = await getUserContext(user_label);

  let systemPrompt = SYSTEM_PROMPT;

  // Tell the agents who they're talking to
  if (user_label && user_label !== 'unknown') {
    const displayName = user_label.charAt(0).toUpperCase() + user_label.slice(1);
    systemPrompt += `\n\nThe user's name is ${displayName}. Use their name naturally in conversation. Not every response, but enough that it feels personal.`;
  }

  // For non-admin users resuming a partial interview
  if (!isAdminUser(user_label) && !isNewUser && !interviewComplete && userContext && messages.length === 1) {
    systemPrompt = SYSTEM_PROMPT + `\n\n--- RESUME INTERVIEW MODE ---
This user started the get-to-know-you interview in a previous session but didn't finish all 15 topics.

Here is what the team already knows about them:
${userContext}

Review what has already been covered. Warmly welcome them back and briefly summarize what you already know. Then tell them which topic you'd like to pick up on next. Ask if they have anything to add to what was already covered before moving forward.

Remind them: if they think of something later about an earlier topic, they can always bring it up and the team will know where to file it.

Continue through the remaining topics from the full list (see interview instructions). Same rules apply: one topic at a time, follow-up questions before moving on, 2-3 agents per round.

When all 15 topics are covered, include the marker [INTERVIEW_COMPLETE] at the very end of your response (after your summary). This signals the system to mark the interview as done.`;
  }

  // For brand new non-admin users with no context on their first message, run interview mode
  if (!isAdminUser(user_label) && isNewUser && messages.length === 1) {
    systemPrompt = SYSTEM_PROMPT + `\n\n--- INTERVIEW MODE ---
This is a brand new user the team has never met. Before brainstorming, the team needs to get to know them through a thorough but warm interview.

INTERVIEW APPROACH:
- One topic area at a time. Do NOT rush through multiple topics in one response.
- Ask follow-up questions and clarifying questions before moving to the next topic. Dig into the details. If they mention something interesting, explore it.
- 2-3 agents per round, taking turns naturally. Agents should react to what the user says, not just read off a list.
- Keep it conversational and warm, not an interrogation. The agents are genuinely curious.
- At any point, remind the user: if they think of something later, they can always bring it up in a future session and the team will know where to file it.

TOPICS TO COVER (in roughly this order, one at a time):

1. WHO THEY ARE: What does your business do and who do you serve? (Or if not a business, what do you spend your time on?)

2. BUSINESS MODEL: How do you make money? Pricing, delivery, what a typical client looks like.

3. TEAM: Who works for you or with you? Employees, contractors, freelancers, partners.

4. TOOLS & SOFTWARE: What off-the-shelf software and tools are you currently using? (Go deep here. The more tools they list, the more the team can spot automation opportunities and custom apps they could build. Ask about categories: communication, project management, finance, marketing, CRM, scheduling, file storage, etc.)

5. DAY TO DAY: What do you spend most of your time on day to day? What does a typical week look like?

6. WHAT'S WORKING: What's working well right now? What are you proud of?

7. WHAT'S BROKEN: What's frustrating or broken? What do you wish worked better?

8. WISH LIST: What do you wish you had more time for?

9. COMMUNICATION STYLE: How do you like to communicate? Direct, detailed, casual, formal? Do you prefer the team to be blunt or gentle when pushing back on ideas?

10. 90-DAY GOALS: What are your goals for the next 90 days? What would make the biggest difference?

11. PATTERNS & BLIND SPOTS: What are your patterns when you get stuck or distracted? What pulls you off track?

12. ORGANIZATION: How do you like to stay organized? Do you want a running record of projects and progress? Should the team help track things across sessions?

13. GUARDRAILS: If you start working on something outside your goals, do you want the team to gently ask if that's where you want to spend your time?

14. BRAINSTORM PREFERENCES: What kind of help are you hoping to get from brainstorming sessions? Strategy, problem-solving, creative ideas, gut-checks, planning, something else?

15. ANYTHING ELSE: Is there anything we haven't covered about you or your business that would be helpful for the team to know?

AFTER ALL TOPICS ARE COVERED:
- Summarize what the team has learned in a clear, organized way.
- Let the user know that everything has been saved and the team will remember it across all future sessions.
- Tell them they can download a file of this session to drop into their own Claude on their computer, so both systems stay in sync.
- Invite them to bring their first brainstorming topic whenever they're ready.
- Include the marker [INTERVIEW_COMPLETE] at the very end of your final response (after your summary). This signals the system to mark the interview as done.

Remind the user throughout: if they think of something later about an earlier topic, they can always bring it up in a future session and the team will know where to file it.

The user's first message will likely be a greeting since they chose to do the interview. Start with a warm welcome from 2-3 agents, then begin with topic 1.`;
  }

  // Load existing user context into prompt
  if (userContext) {
    systemPrompt += '\n\n--- ABOUT THIS USER (from previous sessions) ---\n' + userContext;
  }

  // Load business context and recent conversations for admin users
  if (isAdminUser(user_label)) {
    const context = await getAdminContext();
    if (context) {
      systemPrompt += '\n\n--- BUSINESS CONTEXT (confidential, for this user only) ---\n' + context;
    }

    // Inject recent brainstorm conversations so agents have continuity
    if (messages.length <= 1) {
      const recentConvos = await getRecentConversations(user_label);
      if (recentConvos) {
        systemPrompt += '\n\n--- RECENT BRAINSTORM CONVERSATIONS (last 24 hours) ---\nThe user had these earlier conversations with the team today. Reference them naturally if relevant, but don\'t recite them back unless asked.\n' + recentConvos;
      }
    }
  }

  // Document injection: check if the latest user message triggers any document keywords
  const latestUserMsg = messages[messages.length - 1];
  if (latestUserMsg && latestUserMsg.role === 'user' && latestUserMsg.content) {
    const matchedDocs = await getMatchingDocuments(latestUserMsg.content, messages);
    if (matchedDocs.length > 0) {
      for (const doc of matchedDocs) {
        systemPrompt += `\n\n--- REFERENCE DOCUMENT: ${doc.title} ---\nThe user's message matched keywords for this document. Use this content to inform your response. Reference specific details, examples, and numbers from the document when relevant. Do not dump the whole document back at them, but weave the knowledge into your answers naturally.\n\n${doc.content}`;
      }
      // Add injection markers to the user message so we don't re-inject next turn
      // We append hidden markers that won't affect the conversation
      const markers = matchedDocs.map(d => `[DOC_INJECTED:${d.slug}]`).join('');
      managedMessages[managedMessages.length - 1] = {
        ...managedMessages[managedMessages.length - 1],
        content: managedMessages[managedMessages.length - 1].content + '\n' + markers,
      };
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
