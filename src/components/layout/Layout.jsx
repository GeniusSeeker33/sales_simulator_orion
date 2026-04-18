import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function Layout({ title, children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-shell">
        <Topbar title={title} />
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}