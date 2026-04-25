import db from '../_lib/db.js';
import { getClientId } from '../_lib/auth.js';

export default function handler(req, res) {
  const clientId = getClientId(req);

  const employees = db.employees.filter(e => e.clientId === clientId);

  res.json({ employees });
}