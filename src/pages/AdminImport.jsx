import { useState } from "react";

export default function AdminImport() {
  const [json, setJson] = useState("");

  const importEmployees = async () => {
    try {
      const res = await fetch("/api/employees/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: json,
      });

      const data = await res.json();
      alert(`Imported ${data.count || 0} employees`);
    } catch (err) {
      console.error(err);
      alert("Import failed. Check console.");
    }
  };

  return (
    <div style={{ padding: "40px", color: "white" }}>
      <h1>Admin Import</h1>
      <p>Paste employee JSON below.</p>

      <textarea
        rows="14"
        style={{ width: "100%", padding: "12px" }}
        value={json}
        onChange={(e) => setJson(e.target.value)}
        placeholder='{"employees":[{"firstName":"Chase","lastName":"Farmer","email":"chase@orionwholesaleonline.com","code":"CJF","location":"IN","hireDate":"2022-05-09"}]}'
      />

      <br /><br />

      <button onClick={importEmployees}>
        Import Employees
      </button>
    </div>
  );
}