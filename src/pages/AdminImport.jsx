import { useState } from "react";

const TABS = ["employees", "contacts", "products", "calls"];

export default function AdminImport() {
  const [activeTab, setActiveTab] = useState("employees");
  const [json, setJson] = useState("");

  const handleImport = async () => {
    try {
      const payload = JSON.parse(json);

      if (activeTab === "contacts") {
        const existing = JSON.parse(localStorage.getItem("importedContacts") || "[]");
        const incoming = payload.contacts || [];

        localStorage.setItem(
          "importedContacts",
          JSON.stringify([...incoming, ...existing])
        );

        alert(`Imported ${incoming.length} contacts`);
        return;
      }

      if (activeTab === "calls") {
        const existing = JSON.parse(localStorage.getItem("ringCentralCalls") || "[]");
        const incoming = payload.calls || [];

        localStorage.setItem(
          "ringCentralCalls",
          JSON.stringify([...incoming, ...existing])
        );

        alert(`Imported ${incoming.length} RingCentral calls`);
        return;
      }

      if (activeTab === "employees") {
        const res = await fetch("/api/employees/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: json,
        });

        const data = await res.json();
        alert(`Imported ${data.count || 0} employees`);
        return;
      }

      if (activeTab === "products") {
        const existing = JSON.parse(localStorage.getItem("importedProducts") || "[]");
        const incoming = payload.products || [];

        localStorage.setItem(
          "importedProducts",
          JSON.stringify([...incoming, ...existing])
        );

        alert(`Imported ${incoming.length} products`);
        return;
      }
    } catch (err) {
      console.error(err);
      alert("Import failed. Check your JSON format.");
    }
  };

  return (
    <div style={{ padding: "40px", color: "white" }}>
      <h1>Admin Import Hub</h1>
      <p>Paste JSON and import data into the system.</p>

      <div style={{ marginBottom: 20 }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setJson("");
            }}
            style={{
              marginRight: 10,
              padding: "8px 16px",
              background: activeTab === tab ? "#4CAF50" : "#333",
              color: "white",
              border: "none",
              cursor: "pointer",
            }}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      <p style={{ marginBottom: 10 }}>
        {activeTab === "employees" && "Import employee roster data"}
        {activeTab === "contacts" && "Import customer/prospect data"}
        {activeTab === "products" && "Import product catalog from Business Central"}
        {activeTab === "calls" && "Import RingCentral call logs"}
      </p>

      <textarea
        rows="14"
        style={{ width: "100%", padding: "12px" }}
        value={json}
        onChange={(e) => setJson(e.target.value)}
        placeholder={getPlaceholder(activeTab)}
      />

      <br />
      <br />

      <button onClick={handleImport}>Import {activeTab}</button>
    </div>
  );
}

function getPlaceholder(tab) {
  if (tab === "employees") {
    return `{
  "employees": [
    {
      "firstName": "Chase",
      "lastName": "Farmer",
      "email": "chase@orionwholesaleonline.com",
      "code": "CJF",
      "location": "IN",
      "hireDate": "2022-05-09"
    }
  ]
}`;
  }

  if (tab === "contacts") {
    return `{
  "contacts": [
    {
      "accountName": "ABC Firearms",
      "contactName": "John Smith",
      "phone": "8125551234",
      "email": "john@abc.com",
      "assignedRep": "CJF",
      "territory": "IN",
      "status": "Prospect"
    }
  ]
}`;
  }

  if (tab === "products") {
    return `{
  "products": [
    {
      "name": "9mm Ammo",
      "category": "Ammunition",
      "price": 12.99,
      "inventory": 500
    }
  ]
}`;
  }

  if (tab === "calls") {
    return `{
  "calls": [
    {
      "sessionId": "rc-001",
      "repCode": "CJF",
      "repName": "Chase Farmer",
      "phone": "8125551234",
      "direction": "Outbound",
      "result": "Connected",
      "durationSeconds": 245,
      "dealerName": "ABC Firearms",
      "contactName": "John Smith",
      "startedAt": "2026-04-27T10:15:00Z",
      "notes": "Discussed hunting inventory and next order."
    }
  ]
}`;
  }

  return "";
}