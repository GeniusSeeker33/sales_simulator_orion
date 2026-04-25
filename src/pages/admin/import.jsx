import { useState } from 'react';

export default function ImportPage() {
  const [json, setJson] = useState('');

  const importEmployees = async () => {
    const res = await fetch('/api/employees/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: json
    });

    const data = await res.json();
    alert(`Imported ${data.count} employees`);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Import Employees (Paste JSON)</h2>

      <textarea
        rows={10}
        cols={80}
        value={json}
        onChange={(e) => setJson(e.target.value)}
      />

      <br /><br />

      <button onClick={importEmployees}>
        Import Employees
      </button>
    </div>
  );
}