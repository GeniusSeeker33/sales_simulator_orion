import db from "../_lib/db.js";
import { getClientId } from "../_lib/auth.js";

export default function handler(req, res) {
  const clientId = getClientId(req);

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const contacts = db.contacts.filter((contact) => contact.clientId === clientId);

  return res.status(200).json({ contacts });
}