import { useState } from "react";

const objectionOptions = [
  "price",
  "availability",
  "shipping",
  "trust",
  "competitor",
];

export default function OrderBuilder({
  orderItems,
  addOrderItem,
  objections,
  toggleObjection,
}) {
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState(1);

  function handleAddItem() {
    if (!sku.trim()) return;

    addOrderItem({
      sku: sku.trim(),
      qty: Number(qty || 1),
    });

    setSku("");
    setQty(1);
  }

  return (
    <aside className="simulator-panel">
      <h2>Order Builder</h2>

      <label>
        Product / SKU
        <input
          value={sku}
          onChange={(event) => setSku(event.target.value)}
          placeholder="Example: 9mm ammo, optics, holster..."
        />
      </label>

      <label>
        Quantity
        <input
          type="number"
          min="1"
          value={qty}
          onChange={(event) => setQty(event.target.value)}
        />
      </label>

      <button onClick={handleAddItem}>Add Item</button>

      <ul className="simulator-order-list">
        {orderItems.map((item, index) => (
          <li key={`${item.sku}-${index}`}>
            {item.qty} × {item.sku}
          </li>
        ))}
      </ul>

      <h3>Objection Tracker</h3>

      <div className="simulator-checkbox-list">
        {objectionOptions.map((item) => (
          <label key={item}>
            <input
              type="checkbox"
              checked={objections.includes(item)}
              onChange={() => toggleObjection(item)}
            />
            {item.charAt(0).toUpperCase() + item.slice(1)}
          </label>
        ))}
      </div>
    </aside>
  );
}