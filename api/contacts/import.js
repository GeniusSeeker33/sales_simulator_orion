import db from "../_lib/db.js";
import { getClientId } from "../_lib/auth.js";

export default function handler(req, res) {
  const clientId = getClientId(req);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { contacts } = req.body;

  if (!Array.isArray(contacts)) {
    return res.status(400).json({
      error: "Invalid payload. Expected { contacts: [] }",
    });
  }

  const mapped = contacts.map((contact, index) => {
    const phone = normalizePhone(contact.phone);

    return {
      id: contact.id || `${clientId}-contact-${phone || index}`,
      clientId,
      accountName: contact.accountName || "",
      contactName: contact.contactName || "",
      phone,
      email: contact.email || "",
      assignedRep: contact.assignedRep || "",
      territory: contact.territory || "",
      status: contact.status || "Prospect",
      customerType: contact.customerType || "",
      priority: contact.priority || "",
      lastContactDate: contact.lastContactDate || "",
      rulesOfEngagement: contact.rulesOfEngagement || "",
      notes: contact.notes || "",
      source: contact.source || "Excel Import",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  db.contacts.push(...mapped);

  return res.status(200).json({
    success: true,
    count: mapped.length,
    contacts: mapped,
  });
}

function normalizePhone(phone) {
  if (!phone) return "";
  return String(phone).replace(/\D/g, "");
}