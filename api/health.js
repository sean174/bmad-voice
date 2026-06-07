export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({
    ok: true,
    app: 'mastermind',
    checks: {
      authConfigured: Boolean(process.env.SESSION_SECRET),
      loginConfigured: Boolean(process.env.AUTH_PASSWORDS),
      commandCenterContextConfigured: Boolean(process.env.COMMAND_CENTER_CONTEXT_URL && process.env.MASTERMIND_BRIDGE_TOKEN),
      ideasBridgeConfigured: Boolean(process.env.COMMAND_CENTER_IDEAS_URL && process.env.MASTERMIND_BRIDGE_TOKEN),
      chatJobsConfigured: Boolean(process.env.POSTGRES_URL),
      hermesConfigured: Boolean(process.env.HERMES_API_BASE_URL),
    },
  });
}
