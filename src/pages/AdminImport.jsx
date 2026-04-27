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

  const loadDemoData = () => {
  const demoCalls = [
    {
      sessionId: "rc-001",
      repCode: "CJF",
      dealerName: "ABC Firearms",
      contactName: "John Smith",
      direction: "Outbound",
      result: "Connected",
      durationSeconds: 245,
      startedAt: new Date().toISOString(),
      notes: "Discussed 9mm ammo order and restock timing",
    },
    {
      sessionId: "rc-002",
      repCode: "CJF",
      dealerName: "XYZ Guns",
      contactName: "Mike Johnson",
      direction: "Outbound",
      result: "Voicemail",
      durationSeconds: 35,
      startedAt: new Date().toISOString(),
      notes: "Left voicemail about new inventory drop",
    },
  ];

  const demoSimulator = [
    {
      id: "sim-001",
      assignedRep: "CJF",
      dealerName: "ABC Firearms",
      primaryBuyer: "John Smith",
      difficulty: "Medium",
      createdAt: new Date().toISOString(),
      score: {
        overall: 58,
        coachingNote: "Struggled with closing. Needs stronger urgency.",
      },
    },
    {
      id: "sim-002",
      assignedRep: "CJF",
      dealerName: "XYZ Guns",
      primaryBuyer: "Mike Johnson",
      difficulty: "Hard",
      createdAt: new Date().toISOString(),
      score: {
        overall: 82,
        coachingNote: "Strong objection handling and product knowledge.",
      },
    },
  ];

  const demoProducts = [
    {
      sku: "AMMO-9MM-115",
      name: "9mm 115gr FMJ Ammo",
      category: "Ammunition",
      brand: "Orion Select",
      dealerPrice: 12.99,
      retailPrice: 17.99,
      inventory: 500,
      margin: 5,
      velocity: "High",
      recommendedFor: "range ammo, high turnover",
    },
    {
      sku: "AMMO-556-62GR",
      name: "5.56 NATO 62gr Ammo",
      category: "Ammunition",
      brand: "Orion Defense",
      dealerPrice: 14.99,
      retailPrice: 21.99,
      inventory: 320,
      margin: 7,
      velocity: "High",
      recommendedFor: "rifle buyers, tactical customers",
    },
    {
      sku: "PISTOL-G19",
      name: "Compact 9mm Pistol",
      category: "Handguns",
      brand: "Orion Defense",
      dealerPrice: 399,
      retailPrice: 499,
      inventory: 42,
      margin: 100,
      velocity: "Medium",
      recommendedFor: "concealed carry, first-time buyers",
    },
    {
      sku: "RIFLE-AR15",
      name: "AR-15 Tactical Rifle",
      category: "Rifles",
      brand: "Orion Defense",
      dealerPrice: 649,
      retailPrice: 799,
      inventory: 24,
      margin: 150,
      velocity: "Medium",
      recommendedFor: "tactical display, high-ticket items",
    },
  ];

  localStorage.setItem("ringCentralCalls", JSON.stringify(demoCalls));
  localStorage.setItem("simulatorResults", JSON.stringify(demoSimulator));
  localStorage.setItem("importedProducts", JSON.stringify(demoProducts));

  alert("Full demo data loaded 🚀 (calls + simulator + inventory)");
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

      <button
        onClick={loadDemoData}
        style={{
          marginRight: 10,
          padding: "8px 16px",
          background: "#2196F3",
          color: "white",
          border: "none",
          cursor: "pointer",
        }}
      >
        Load Demo Data
      </button>

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
      "sku": "AMMO-9MM-115",
      "name": "9mm 115gr FMJ Ammo",
      "category": "Ammunition",
      "brand": "Orion Select",
      "dealerPrice": 12.99,
      "retailPrice": 17.99,
      "inventory": 500,
      "margin": 5,
      "velocity": "High",
      "recommendedFor": "Indoor ranges, self-defense buyers, volume ammo customers"
    },
    {
      "sku": "RIFLE-556-001",
      "name": "5.56 Tactical Rifle",
      "category": "Rifles",
      "brand": "Orion Defense",
      "dealerPrice": 649,
      "retailPrice": 799,
      "inventory": 24,
      "margin": 150,
      "velocity": "Medium",
      "recommendedFor": "AR buyers, patrol rifle customers, tactical display inventory"
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