export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tasks } = req.body;

  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ error: 'Tasks array required' });
  }

  if (tasks.length > 20) {
    return res.status(400).json({ error: 'Maximum 20 tasks per request' });
  }

  const results = [];

  for (const task of tasks) {
    try {
      const body = {
        data: {
          name: task.title,
          notes: task.notes || '',
          projects: [process.env.ASANA_PROJECT_ID],
        },
      };

      if (task.due_date) {
        body.data.due_on = task.due_date;
      }

      const response = await fetch('https://app.asana.com/api/1.0/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ASANA_ACCESS_TOKEN}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error('Asana error:', errBody);
        results.push({ title: task.title, success: false, error: 'Failed to create task' });
      } else {
        const data = await response.json();
        results.push({ title: task.title, success: true, id: data.data.gid });
      }
    } catch (err) {
      console.error('Task creation error:', err);
      results.push({ title: task.title, success: false, error: err.message });
    }
  }

  return res.status(200).json({ results });
}
