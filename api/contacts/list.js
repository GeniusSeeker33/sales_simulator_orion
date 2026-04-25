import db from '../_lib/db.js';
import { getClientId } from '../_lib/auth.js';

export default function handler(req, res) {
  const clientId = getClientId(req);

  const contacts = db.contacts.filter(c => c.clientId === clientId);

  res.json({ contacts });
}