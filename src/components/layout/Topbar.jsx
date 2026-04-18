export default function Topbar({ title }) {
  return (
    <header className="topbar">
      <div>
        <h1>{title}</h1>
        <p>Level-based sales performance operating system</p>
      </div>

      <div className="topbar-user">
        <div className="topbar-pill">Level 2 AE</div>
        <div className="topbar-pill">$85 bonus available</div>
      </div>
    </header>
  );
}