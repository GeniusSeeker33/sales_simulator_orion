import db from '../_lib/db.js';
import { getClientId } from '../_lib/auth.js';

export default function handler(req, res) {
  const clientId = getClientId(req);

  const { contacts } = req.body;

  const mapped = contacts.map(c => ({
    id: `${clientId}-${c.phone}`,
    clientId,
    accountName: c.accountName,
    contactName: c.contactName,
    phone: c.phone,
    email: c.email,
    assignedRep: c.assignedRep,
    territory: c.territory,
    status: c.status,
    lastContactDate: c.lastContactDate,
    createdAt: new Date()
  }));

  db.contacts.push(...mapped);

  res.json({ success: true, count: mapped.length });
}