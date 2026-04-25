import db from '../_lib/db.js';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, clientId } = req.body;

  const newClient = {
    id: clientId,
    name,
    createdAt: new Date()
  };

  db.clients.push(newClient);

  res.json({ success: true, client: newClient });
}