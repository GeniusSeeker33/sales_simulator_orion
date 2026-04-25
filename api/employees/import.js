import db from '../_lib/db.js';
import { getClientId } from '../_lib/auth.js';

export default function handler(req, res) {
  const clientId = getClientId(req);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { employees } = req.body;

  const mapped = employees.map(emp => ({
    id: `${clientId}-${emp.code}`,
    clientId,
    firstName: emp.firstName,
    lastName: emp.lastName,
    email: emp.email,
    code: emp.code,
    location: emp.location,
    hireDate: emp.hireDate,
    createdAt: new Date()
  }));

  db.employees.push(...mapped);

  res.json({ success: true, count: mapped.length });
}